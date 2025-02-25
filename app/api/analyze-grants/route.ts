import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { OpenAI } from 'openai'
import puppeteer from 'puppeteer'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  defaultQuery: { model: process.env.OPENAI_MODEL }
})

const login = async () => {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Navigate to login page
    await page.goto('https://www.grantwatch.com/join-login.php?vw=login', { waitUntil: 'networkidle0' })

    // Fill in email
    await page.type('input[name="email"]', process.env.GRANTWATCH_USERNAME || '')
    await page.click('button[id="btn-login"]')
    
    // Wait for password field to become visible
    await page.waitForSelector('input[name="password"]', { visible: true })

    // Fill in password
    await page.type('input[name="password"]', process.env.GRANTWATCH_PASSWORD || '')
    await page.click('button[id="btn-login"]')
    await page.waitForNavigation({ waitUntil: 'networkidle0' })

    // Get cookies after successful login using browser context
    const context = browser.defaultBrowserContext()
    const cookies = await context.cookies()
    return cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`)
  } finally {
    await browser.close()
  }
}

const scrapeGrants = async (url: string, cookies: string[]) => {
  const response = await axios.get(url, {
    headers: { Cookie: cookies.join('; ') }
  })
  const $ = cheerio.load(response.data)
  
  const cardSelector = '.grnhomegbox'
  const grants: { title: string; url: string; summary: string; deadline: string }[] = []
  
  $(cardSelector).each((_: any, element: any) => {
    const title = $(element).find('h4').text().trim()
    const url = $(element).find('> a').attr('href')
    const fullUrl = url ? `https://www.grantwatch.com${url}` : ''
    const deadline = $(element).find('.ddlinedtgwhm span em').text().trim()
    const summary = $(element).find('.grnhomegboxtext p').text().trim()
    
    grants.push({ 
      title, 
      url: fullUrl, 
      summary, 
      deadline 
    })
  })

  // Update pagination logic to navigate pages sequentially
  let nextPage = null
  const pagination = $('.pagination')
  
  if (pagination.length > 0) {
    // Find the current active page
    const activeLi = $('.pagination li.active')
    
    if (activeLi.length > 0) {
      // Try to find the next sequential page by looking at the next sibling
      let nextLi = activeLi.next()
      
      // Skip ellipsis (...) items
      while (nextLi.length > 0 && nextLi.find('a').text() === '...') {
        nextLi = nextLi.next()
      }
      
      // Get href if this is a valid navigation item (not the last "»" button)
      const nextHref = nextLi.find('a').attr('href')
      
      if (nextHref && !nextHref.includes('javascript:void(0)') && nextLi.index() < $('.pagination li').length - 1) {
        nextPage = 'https://www.grantwatch.com' + nextHref
        console.log(`Moving to next page: ${nextPage}`)
      }
    }
  }
  
  return { grants, nextPage }
}

const analyzeGrant = async (grant: { title: string, url: string, summary: string, deadline: string }, requirements: string) => {
  const systemPrompt = `You are a grant evaluation assistant. Analyze this grant opportunity and provide a clear recommendation based on these criteria:

1. Feasibility: Review the requirements and determine if the grant is feasible.
2. Funding Adequacy: The grant amount must be sufficient for meaningful development work
3. Relevance: The grant must be relevant to the requirements.

LegiEquity Company Background:
Our Mission: We strive to democratize legislative analysis by providing clear, unbiased insights into how bills impact different communities. Our platform empowers citizens, legislators, and advocacy groups with data-driven understanding of legislative effects.
Technology: Using state-of-the-art AI and machine learning, we analyze legislative text to identify potential impacts across various demographic groups. Our technology provides unprecedented insight into the real-world effects of legislation.

Your response must be a valid JSON object with these properties:
- recommendation: "YES" or "NO"
- reason: A brief 1-2 sentence explanation

Example response:
{
  "recommendation": "YES",
  "reason": "This grant directly supports technology development with adequate funding and has a feasible timeline."
}
`

  const userPrompt = `Please analyze this grant opportunity:

Title: ${grant.title}
Summary: ${grant.summary}
Deadline: ${grant.deadline}

Matching Requirements: ${requirements}`

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.7,
    response_format: { type: "json_object" }
  })

  const analysisText = completion.choices[0].message.content || "";
  let analysis;
  try {
    analysis = JSON.parse(analysisText);
  } catch (error) {
    analysis = { 
      recommendation: "UNKNOWN", 
      reason: "Failed to parse analysis result" 
    };
  }

  return {
    ...grant,
    analysis
  }
}

export async function POST(request: Request) {
  const { url, requirements } = await request.json()
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const processGrants = async () => {
    try {
      const cookies = await login()
      let currentUrl = url

      // Check if cookies is defined before proceeding
      if (!cookies) {
        throw new Error('Failed to obtain cookies from login')
      }

      while (currentUrl) {
        const { grants, nextPage } = await scrapeGrants(currentUrl, cookies)

        for (const grant of grants) {
          const analyzedGrant = await analyzeGrant(grant, requirements)
          await writer.write(encoder.encode(JSON.stringify([analyzedGrant]) + '\n'))
        }

        currentUrl = nextPage
      }
      console.log('No more pages to scrape')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      await writer.close()
    }
  }

  processGrants()

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    }
  })
}