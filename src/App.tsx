import React, { useEffect, useState } from 'react'

interface BookmarkNode {
  id: string
  title?: string
  url?: string
  children?: BookmarkNode[]
}

interface TabGroup {
  id: number
  title?: string
  color: string
  tabs: ChromeTab[]
}

interface ChromeTab extends chrome.tabs.Tab {
  id: number
  title: string
  url: string
  groupId: number
}

interface CollapsibleProps {
  readonly title: string
  readonly children: React.ReactNode
}

function Collapsible({ title, children }: Readonly<CollapsibleProps>) {
  const [open, setOpen] = useState(false)

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setOpen(!open)
    }
  }

  return (
    <div className="collapsible">
      <button
        className="collapsible-header"
        onClick={() => setOpen(!open)}
        onKeyDown={handleKey}
        aria-expanded={open}
      >
        {title}
      </button>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  )
}

const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchBookmarks = () => {
      try {
        chrome.bookmarks.getTree((result) => {
          setBookmarks(result)
          setIsLoading(false)
        })
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setIsLoading(false)
      }
    }

    fetchBookmarks()
  }, [])

  return { bookmarks, isLoading, error }
}

const useTabGroups = () => {
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const getGroupInfo = async (groupId: number, groupTabs: ChromeTab[]) => {
      return new Promise<TabGroup>((resolve) =>
        chrome.tabGroups.get(groupId, (group) => resolve({ ...group, tabs: groupTabs })),
      )
    }

    const fetchTabGroups = async () => {
      try {
        const tabs = await chrome.tabs.query({})
        const groupsMap = tabs.reduce<Record<number, ChromeTab[]>>((acc, tab) => {
          if (tab.groupId !== -1 && tab.id !== undefined && tab.title && tab.url) {
            const chromeTab: ChromeTab = {
              ...tab,
              id: tab.id,
              title: tab.title,
              url: tab.url,
              groupId: tab.groupId,
            }
            if (!acc[tab.groupId]) acc[tab.groupId] = []
            acc[tab.groupId].push(chromeTab)
          }
          return acc
        }, {})

        const groupPromises = Object.entries(groupsMap).map(([groupId, groupTabs]) =>
          getGroupInfo(parseInt(groupId), groupTabs),
        )

        const resolvedGroups = await Promise.all(groupPromises)
        if (isMounted) {
          setTabGroups(resolvedGroups)
          setIsLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
          setIsLoading(false)
        }
      }
    }

    fetchTabGroups()
    return () => {
      isMounted = false
    }
  }, [])

  return { tabGroups, isLoading, error }
}

interface BookmarksListProps {
  readonly bookmarks: readonly BookmarkNode[]
}

const BookmarksList = ({ bookmarks }: Readonly<BookmarksListProps>) => {
  const renderBookmarks = (nodes: readonly BookmarkNode[]) => {
    return nodes.map((node) => {
      if (node.children) {
        return (
          <Collapsible key={node.id} title={node.title ?? 'Unnamed Folder'}>
            {renderBookmarks(node.children)}
          </Collapsible>
        )
      }
      return (
        <div className="bookmark" key={node.id}>
          <a href={node.url} target="_blank" rel="noreferrer">
            {node.title ?? node.url}
          </a>
        </div>
      )
    })
  }

  return renderBookmarks(bookmarks)
}

interface TabGroupsListProps {
  readonly tabGroups: readonly TabGroup[]
}

const TabGroupsList = ({ tabGroups }: Readonly<TabGroupsListProps>) => {
  const handleTabClick = (e: React.MouseEvent, tabId: number) => {
    e.preventDefault()
    chrome.tabs.update(tabId, { active: true })
  }

  return tabGroups.map((group) => (
    <Collapsible key={group.id} title={`Group: ${group.title ?? '(no title)'} - ${group.color}`}>
      {group.tabs.map((tab) => (
        <div className="tab" key={tab.id}>
          <button className="tab-button" onClick={(e) => handleTabClick(e, tab.id)}>
            {tab.title}
          </button>
        </div>
      ))}
    </Collapsible>
  ))
}

function App() {
  const { bookmarks, isLoading: bookmarksLoading, error: bookmarksError } = useBookmarks()
  const { tabGroups, isLoading: tabGroupsLoading, error: tabGroupsError } = useTabGroups()

  if (bookmarksError || tabGroupsError) {
    return <div className="error">Error loading data</div>
  }

  return (
    <div id="container">
      <div id="left">
        <h2>Bookmarks</h2>
        {bookmarksLoading ? (
          <div>Loading bookmarks...</div>
        ) : (
          <BookmarksList bookmarks={bookmarks} />
        )}
      </div>
      <div id="right">
        <h2>Tab Groups</h2>
        {tabGroupsLoading ? (
          <div>Loading tab groups...</div>
        ) : (
          <TabGroupsList tabGroups={tabGroups} />
        )}
      </div>
    </div>
  )
}

export default App
