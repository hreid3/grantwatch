'use client'

import { useState } from 'react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [requirements, setRequirements] = useState(`
    social justice, elections, legislation, civil rights, 
    human rights, voting rights,
    bipoc, social justice, policy change, voter registration,
    technology, software, development, black entrepreneurship,
    black business, black innovation, black technology,
    black software, black entrepreneurship, black business,
    black innovation, black technology, black software,
    black entrepreneurship, black business, black innovation,
    black technology, black software, black entrepreneurship,
    general grants, small business grants, startup grants,
    `)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<Array<{
    title: string
    url: string
    summary: string
  }>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/analyze-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, requirements })
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Failed to get reader')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = new TextDecoder().decode(value)
        const grants = JSON.parse(text)
        setResults(prev => [...prev, ...grants])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Grant Hunt</h1>
      
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8 space-y-4">
        <div className="flex flex-col gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter GrantWatch filter URL"
            required
            className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600"
          />
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Enter your grant requirements (e.g., funding amount, eligibility criteria)"
            rows={4}
            className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none dark:bg-gray-800 dark:text-white dark:border-gray-600"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full md:w-auto md:self-end px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 shadow-sm"
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {results.map((grant, index) => (
          <div key={index} className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">
              <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {grant.title}
              </a>
            </h2>
            <p className="text-gray-600">{grant.summary}</p>
          </div>
        ))}
      </div>
    </div>
  )
}