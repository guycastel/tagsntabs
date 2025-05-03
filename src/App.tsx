import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Classes,
  Collapse,
  Divider,
  H2,
  Icon,
  Intent,
  Spinner,
  Switch,
  Tag
} from '@blueprintjs/core'
import { IconNames } from '@blueprintjs/icons'
import '@blueprintjs/core/lib/css/blueprint.css'
import '@blueprintjs/icons/lib/css/blueprint-icons.css'

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
  readonly title: React.ReactNode
  readonly children: React.ReactNode
}

function Collapsible({ title, children }: Readonly<CollapsibleProps>) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bp4-collapsible">
      <Button
        fill
        alignText="left"
        intent={Intent.NONE}
        icon={open ? IconNames.CHEVRON_DOWN : IconNames.CHEVRON_RIGHT}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {title}
      </Button>
      <Collapse isOpen={open}>
        <div className="bp4-collapsible-content">{children}</div>
      </Collapse>
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

// Helper function moved outside of the hook to reduce nesting
const getGroupInfo = async (groupId: number, groupTabs: ChromeTab[]): Promise<TabGroup> => {
  return new Promise<TabGroup>((resolve) => {
    chrome.tabGroups.get(groupId, (group) => {
      resolve({ ...group, tabs: groupTabs })
    })
  })
}

const useTabGroups = () => {
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchTabGroups = async () => {
      try {
        // Get all tabs
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({}, resolve)
        })

        // Group tabs by their group ID
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

        // Create an array of promises for getting group info
        const groupPromises = Object.entries(groupsMap).map(([groupId, groupTabs]) =>
          getGroupInfo(parseInt(groupId), groupTabs)
        )

        // Resolve all promises
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
          <Button
            intent={Intent.NONE}
            icon={IconNames.DOCUMENT}
            text={node.title ?? node.url}
            onClick={() => window.open(node.url, '_blank')}
          />
        </div>
      )
    })
  }

  return <div className="bookmarks-list">{renderBookmarks(bookmarks)}</div>
}

interface TabGroupsListProps {
  readonly tabGroups: readonly TabGroup[]
}

const TabGroupsList = ({ tabGroups }: Readonly<TabGroupsListProps>) => {
  const handleTabClick = (e: React.MouseEvent, tabId: number) => {
    e.preventDefault()
    chrome.tabs.update(tabId, { active: true })
  }

  return (
    <div className="tab-groups-list">
      {tabGroups.map((group) => (
        <Card key={group.id} className="bp4-tab-group-card" elevation={1} style={{ marginBottom: '10px' }}>
          <Collapsible title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Tag intent={getIntentForColor(group.color)} style={{ marginRight: '8px' }} />
              <span>{group.title ?? '(no title)'}</span>
            </div>
          }>
            {group.tabs.map((tab) => (
              <div className="tab" key={tab.id}>
                <Button
                  intent={Intent.NONE}
                  icon={IconNames.APPLICATION}
                  text={tab.title}
                  onClick={(e) => handleTabClick(e, tab.id)}
                />
              </div>
            ))}
          </Collapsible>
        </Card>
      ))}
    </div>
  )
}

// Helper function to convert Blueprint color to intent
const getIntentForColor = (color: string): Intent => {
  switch (color) {
    case 'red': return Intent.DANGER
    case 'green': return Intent.SUCCESS
    case 'blue': return Intent.PRIMARY
    case 'yellow': return Intent.WARNING
    default: return Intent.NONE
  }
}

function App() {
  const { bookmarks, isLoading: bookmarksLoading, error: bookmarksError } = useBookmarks()
  const { tabGroups, isLoading: tabGroupsLoading, error: tabGroupsError } = useTabGroups()
  const [isDarkTheme, setIsDarkTheme] = useState(false)

  // Apply theme class to body
  useEffect(() => {
    document.body.className = isDarkTheme ? Classes.DARK : ''
  }, [isDarkTheme])

  if (bookmarksError || tabGroupsError) {
    return (
      <div className={`app-container ${isDarkTheme ? Classes.DARK : ''}`}>
        <Card elevation={2} className="error-card">
          <Icon icon={IconNames.ERROR} intent={Intent.DANGER} size={20} />
          <span style={{ marginLeft: '8px' }}>Error loading data</span>
        </Card>
      </div>
    )
  }

  return (
    <div className={`app-container ${isDarkTheme ? Classes.DARK : ''}`}>
      <div className="theme-toggle">
        <Switch
          checked={isDarkTheme}
          onChange={() => setIsDarkTheme(!isDarkTheme)}
          label={isDarkTheme ? "Dark Theme" : "Light Theme"}
        />
      </div>
      <div id="container" className={Classes.CARD}>
        <div id="left">
          <H2>Bookmarks</H2>
          <Divider />
          {bookmarksLoading ? (
            <Spinner size={30} />
          ) : (
            <BookmarksList bookmarks={bookmarks} />
          )}
        </div>
        <div id="right">
          <H2>Tab Groups</H2>
          <Divider />
          {tabGroupsLoading ? (
            <Spinner size={30} />
          ) : (
            <TabGroupsList tabGroups={tabGroups} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
