'use client'

import { useState } from 'react'

type Grant = {
  title: string
  url: string
  summary: string
  deadline: string
  analysis: {
    recommendation: string
    reason: string
  }
}

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
  const [results, setResults] = useState<Grant[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResults([])
    
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

      {/* Table-like results layout */}
      {results.length > 0 && (
        <div className="mt-8">
          <div className="grid grid-cols-12 gap-4 font-bold px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg">
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Deadline</div>
            <div className="col-span-9">Title</div>
          </div>
          
          <div className="space-y-1 mt-1">
            {results.map((grant, index) => {
              const isRecommended = grant.analysis?.recommendation === "YES";
              
              return (
                <div 
                  key={index} 
                  className="grid grid-cols-12 gap-4 px-4 py-3 bg-white dark:bg-gray-900 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => setSelectedGrant(grant)}
                >
                  <div className="col-span-1">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      isRecommended 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {isRecommended ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm">{grant.deadline || 'No deadline'}</div>
                  <div className="col-span-9 truncate">{grant.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Grant details popover */}
      {selectedGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedGrant(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold">{selectedGrant.title}</h2>
                <button 
                  onClick={() => setSelectedGrant(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Deadline</h3>
                  <p>{selectedGrant.deadline || 'No deadline specified'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Recommendation</h3>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      selectedGrant.analysis?.recommendation === "YES" 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {selectedGrant.analysis?.recommendation || 'UNKNOWN'}
                    </span>
                    <p className="mt-2">{selectedGrant.analysis?.reason}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Summary</h3>
                  <p className="mt-1">{selectedGrant.summary}</p>
                </div>
                
                <div className="pt-2">
                  <a 
                    href={selectedGrant.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    View Grant Details
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}