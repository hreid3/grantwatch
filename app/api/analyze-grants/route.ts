import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { OpenAI } from 'openai'
import puppeteer from 'puppeteer'
import type { Cookie } from 'puppeteer'

type CheerioRoot = ReturnType<typeof cheerio.load>
type CheerioElement = cheerio.Element

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
    return cookies.map((cookie: Cookie) => `${cookie.name}=${cookie.value}`)
  } finally {
    await browser.close()
  }
}

const scrapeGrants = async (url: string, cookies: string[]) => {
  const response = await axios.get(url, {
    headers: { Cookie: cookies.join('; ') }
  })
  const $: CheerioRoot = cheerio.load(response.data)
  
  const cardSelector = '.grnhomegbox'
  const grants: { title: string; url: string; summary: string; deadline: string }[] = []
  
  $(cardSelector).each((_: number, element: CheerioElement) => {
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
      }
    }
  }
  
  return { grants, nextPage }
}

const fetchGrantDetails = async (grantUrl: string, cookies: string[]) => {
  try {
    const response = await axios.get(grantUrl, {
      headers: { Cookie: cookies.join('; ') }
    })
    
    const $: CheerioRoot = cheerio.load(response.data)
    
    // Extract detailed information using the selector
    const detailsContainer = $('.row.grntdetboxmainlst')
    
    // Initialize object to store details
    const details: Record<string, string> = {}
    
    // Extract all detail sections
    detailsContainer.each((_: number, element: CheerioElement) => {
      // Get the section title (left column)
      const titleElement = $(element).find('.col-lg-3').first()
      const title = titleElement.find('div[style*="font-size: 20px"]').text().trim()
      
      // Get the content (right column) - focus on the main content div
      const contentElement = $(element).find('.col-lg-9').first()
      const mainContentDiv = contentElement.find('.gndrk.extrs').first()
      
      // Use the main content div if found, otherwise use the whole content column
      const content = mainContentDiv.length 
        ? mainContentDiv.text().trim() 
        : contentElement.text().trim()
      
      if (title && content) {
        details[title] = content
      }
    })
    
    return details
  } catch (error) {
    console.error(`Error fetching grant details for ${grantUrl}:`, error)
    return {}
  }
}

const analyzeGrant = async (grant: { title: string, url: string, summary: string, deadline: string }, requirements: string, cookies: string[]) => {
  // Fetch detailed information about the grant
  const grantDetails = await fetchGrantDetails(grant.url, cookies)
  
  // Convert details object to formatted string
  const detailsText = Object.entries(grantDetails)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  
  const systemPrompt = `You are a grant evaluation assistant. Analyze this grant opportunity and provide a clear recommendation based on these criteria:

1. Feasibility: Review the requirements and determine if the grant is feasible.
2. Funding Adequacy: The grant amount must be sufficient for meaningful development work
3. Relevance: The grant must be relevant to the requirements.

LegiEquity Company Background:
Our Mission: We strive to democratize legislative analysis by providing clear, unbiased insights into how bills impact different communities. Our platform empowers citizens, legislators, and advocacy groups with data-driven understanding of legislative effects. Understand how bills and laws affect communities across age, disability, gender, race, and religion
Technology: Using state-of-the-art AI and machine learning, we analyze legislative text to identify potential impacts across various demographic groups. Our technology provides unprecedented insight into the real-world effects of legislation.
Company Location: Atlanta Metro Area, Georgia
Black-owned: Yes

Your response must be a valid JSON object with these properties:
- recommendation: "YES" or "NO"
- reason: A brief 1-2 sentence explanation
- confidence: A number between 1 and 10 indicating your confidence level in this recommendation (1 = very low confidence, 10 = very high confidence)

Example response:
{
  "recommendation": "YES",
  "reason": "This grant directly supports technology development with adequate funding and has a feasible timeline.",
  "confidence": 8
}
`

  const userPrompt = `Please analyze this grant opportunity:

Title: ${grant.title}
Summary: ${grant.summary}
Deadline: ${grant.deadline}

${detailsText ? `Additional Grant Details:\n${detailsText}\n` : ''}
Matching Requirements: ${requirements}`

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.0,
    response_format: { type: "json_object" }
  })

  const analysisText = completion.choices[0].message.content || "";
  let analysis;
  try {
    analysis = JSON.parse(analysisText);
  } catch (error) {
    console.error("Failed to parse analysis result:", error);
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
          const analyzedGrant = await analyzeGrant(grant, requirements, cookies)
          await writer.write(encoder.encode(JSON.stringify([analyzedGrant]) + '\n'))
        }

        currentUrl = nextPage
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      await writer.close()
    }
  }

  processGrants()

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity'
    }
  })
}