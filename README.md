# Grant Hunt - AI-Powered Grant Analysis Tool

A specialized application that automates the discovery and evaluation of grant opportunities from GrantWatch based on custom requirements. The tool uses AI to analyze grant details and provide recommendations to help users quickly identify the most relevant funding opportunities.

## Features

- **Automated Grant Scraping**: Connects to GrantWatch and extracts grant details across multiple pages
- **Detailed Content Analysis**: Uses AI to evaluate each grant based on custom criteria
- **Confidence Scoring**: Provides a confidence level for each recommendation
- **Visual Indicators**: Color-coded results make it easy to identify promising opportunities
- **Detailed Grant Information**: View comprehensive information about each grant including eligibility requirements
- **Responsive UI**: Works well on desktop and mobile devices

## Technologies Used

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Node.js, Next.js API routes
- **Web Scraping**: Puppeteer, Cheerio, Axios
- **AI Analysis**: OpenAI API (GPT models)
- **Authentication**: Automated login to access GrantWatch premium content

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-3.5-turbo # or your preferred model
   GRANTWATCH_USERNAME=your_grantwatch_email
   GRANTWATCH_PASSWORD=your_grantwatch_password
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Enter a GrantWatch filter URL (e.g., `https://usa.grantwatch.com/cat/57/social-justice-grants.html`)
2. Customize or use the default requirements to match your organization's needs
3. Click "Analyze" to begin the process
4. Review the results:
   - Green highlighted rows represent recommended grants
   - Each recommendation includes a confidence score
   - Click on any grant to view detailed information
   - Click "View Grant Details" to visit the original grant page

## How It Works

1. **Authentication**: The app logs into GrantWatch using puppeteer to obtain session cookies
2. **Scraping**: Using the cookies, it scrapes grant listings from the provided URL
3. **Pagination**: Automatically navigates through all pages of results
4. **Detailed Analysis**: For each grant, it:
   - Extracts basic information (title, deadline, summary)
   - Visits the grant detail page to extract comprehensive information
   - Sends the data to OpenAI for analysis
5. **AI Evaluation**: The AI evaluates each grant based on:
   - Feasibility
   - Funding adequacy
   - Relevance to the specified requirements
6. **Result Display**: Presents the results in a user-friendly interface with recommendations

## Limitations

- Requires a valid GrantWatch account with appropriate permissions
- Analysis quality depends on the OpenAI model used and the specificity of requirements
- Web scraping may break if GrantWatch changes their website structure
- Rate limitations may apply based on OpenAI API usage and GrantWatch session limits

## Best Practices

- Be specific with your requirements for better matching
- Review both high and low confidence recommendations
- Always verify AI recommendations by reviewing the grant details manually
- Use more advanced OpenAI models for higher quality analysis

## License

[MIT License](LICENSE)
