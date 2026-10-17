'use client'

import { useEffect, useState } from 'react'

import { Svg } from './docGroups'

export type GuideNavGroup = { id: string; title: string; icon: 'plan' | 'book'; items: { id: string; title: string }[] }

const ICONS = {
  plan: <path d="M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6" />,
  book: <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" />,
}

/**
 * The guides page's contents menu: each group with its topics listed under it, so a topic is one click
 * away. While the page scrolls, the topic on screen (and its group) is highlighted. On a phone only the
 * groups are shown, as a row of buttons.
 */
export function GuideNav({ groups }: { groups: GuideNavGroup[] }) {
  const [active, setActive] = useState<string | undefined>(groups[0]?.items[0]?.id ?? groups[0]?.id)
  useEffect(() => {
    // in page order: a group's own band, then its topics
    const ids = groups.flatMap((g) => [g.id, ...g.items.map((i) => i.id)])
    let frame = 0
    const update = () => {
      let next = ids[0]
      for (const id of ids) {
        if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 180) next = id
      }
      setActive(next)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [groups])

  const groupOf = (id?: string) => groups.find((g) => g.id === id || g.items.some((i) => i.id === id))?.id
  return (
    <nav className="guide-nav" aria-label="หมวดแผนงานและคู่มือ">
      <h2>หมวดเนื้อหา</h2>
      {groups.map((g) => (
        <div key={g.id} className={`guide-nav__group${groupOf(active) === g.id ? ' is-current' : ''}`}>
          <a href={`#${g.id}`} className="guide-nav__head" aria-current={active === g.id ? 'location' : undefined}>
            <Svg size={20}>{ICONS[g.icon]}</Svg>
            <span>{g.title}</span>
            <span className="guide-nav__n">{g.items.length}</span>
          </a>
          {g.items.length > 0 && (
            <ul className="guide-nav__items">
              {g.items.map((i) => (
                <li key={i.id}>
                  <a href={`#${i.id}`} aria-current={active === i.id ? 'location' : undefined}>
                    {i.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  )
}
