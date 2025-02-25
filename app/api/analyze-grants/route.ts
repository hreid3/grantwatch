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

  // Update pagination logic
  let nextPage = null
  const pagination = $('.pagination')
  
  if (pagination.length > 0) {
    const activePageHref = $('.pagination .active a').attr('href')
    const nextButtonHref = $('.pagination li:last-child a').attr('href')
    
    // If the next button link exists and points to a different URL than the current active page
    if (nextButtonHref && activePageHref && nextButtonHref !== activePageHref) {
      nextPage = 'https://www.grantwatch.com' + nextButtonHref
    }
  }
  
  return { grants, nextPage }
}

const analyzeGrant = async (grant: { title: string, url: string, summary: string, deadline: string }, requirements: string) => {
  const systemPrompt = `You are a grant evaluation assistant. Analyze this grant opportunity and provide a clear YES/NO recommendation based on these criteria:

1. Technology Focus: The grant must directly support technology or software development projects
2. Funding Adequacy: The grant amount must be sufficient for meaningful development work
3. Feasibility: The application process and requirements must be reasonable and achievable
4. Timeline: The grant schedule must allow proper implementation

Provide your response in this format:
Recommendation: [YES/NO]
Reason: [Brief 1-2 sentence explanation]`

  const userPrompt = `Please analyze this grant opportunity:

Title: ${grant.title}
Summary: ${grant.summary}
Deadline: ${grant.deadline}

Additional Requirements: ${requirements}`

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.7,
  })

  return {
    ...grant,
    analysis: completion.choices[0].message.content
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