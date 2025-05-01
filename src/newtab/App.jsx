import React, { useEffect, useState } from 'react';

function Collapsible({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        {title}
      </div>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

function App() {
  const [bookmarks, setBookmarks] = useState([]);
  const [tabGroups, setTabGroups] = useState([]);

  useEffect(() => {
    chrome.bookmarks.getTree(setBookmarks);

    chrome.tabs.query({}, (tabs) => {
      const groups = {};
      tabs.forEach((tab) => {
        if (tab.groupId !== -1) {
          if (!groups[tab.groupId]) groups[tab.groupId] = [];
          groups[tab.groupId].push(tab);
        }
      });

      const groupData = [];
      const groupIds = Object.keys(groups);
      let pending = groupIds.length;

      groupIds.forEach((groupId) => {
        chrome.tabGroups.get(parseInt(groupId), (group) => {
          groupData.push({ ...group, tabs: groups[groupId] });
          if (--pending === 0) setTabGroups(groupData);
        });
      });
    });
  }, []);

  const renderBookmarks = (nodes) => {
    return nodes.map((node) => {
      if (node.children) {
        return (
          <Collapsible key={node.id} title={node.title || 'Unnamed Folder'}>
            {renderBookmarks(node.children)}
          </Collapsible>
        );
      } else {
        return (
          <div className="bookmark" key={node.id}>
            <a href={node.url} target="_blank" rel="noreferrer">
              {node.title || node.url}
            </a>
          </div>
        );
      }
    });
  };

  return (
    <div id="container">
      <div id="left">
        <h2>Bookmarks</h2>
        {renderBookmarks(bookmarks)}
      </div>
      <div id="right">
        <h2>Tab Groups</h2>
        {tabGroups.map((group, index) => (
          <Collapsible
            key={index}
            title={`Group: ${group.title || '(no title)'} - ${group.color}`}
          >
            {group.tabs.map((tab) => (
              <div className="tab" key={tab.id}>
                <a href="#" onClick={() => chrome.tabs.update(tab.id, { active: true })}>
                  {tab.title}
                </a>
              </div>
            ))}
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

export default App;
