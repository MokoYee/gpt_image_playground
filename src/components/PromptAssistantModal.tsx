import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { promptAssistantCategories, promptAssistantItems } from '../lib/promptAssistant'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { CloseIcon } from './icons'

interface PromptAssistantModalProps {
  open: boolean
  onClose: () => void
  onAppend: (prompt: string) => void
  onReplace: (prompt: string) => void
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase()
}

export default function PromptAssistantModal({ open, onClose, onAppend, onReplace }: PromptAssistantModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [activeCategoryId, setActiveCategoryId] = useState('all')
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearchText(query)

  useCloseOnEscape(open, onClose)
  usePreventBackgroundScroll(open, modalRef)

  const filteredItems = useMemo(() => {
    return promptAssistantItems.filter((item) => {
      if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) return false
      if (!normalizedQuery) return true
      const haystack = `${item.title} ${item.prompt} ${item.tags.join(' ')}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [activeCategoryId, normalizedQuery])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="prompt-assistant-modal animate-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-assistant-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="prompt-assistant-header">
          <div>
            <h2 id="prompt-assistant-title">提示词助手</h2>
          </div>
          <button type="button" className="prompt-assistant-close" onClick={onClose} aria-label="关闭">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="prompt-assistant-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m16.5 16.5 4 4" />
          </svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索风格、主体、镜头、场景..." autoFocus />
        </div>

        <div className="prompt-assistant-body">
          <aside className="prompt-assistant-categories" aria-label="提示词分类">
            {promptAssistantCategories.map((category) => {
              const count = category.id === 'all'
                ? promptAssistantItems.length
                : promptAssistantItems.filter((item) => item.categoryId === category.id).length
              return (
                <button
                  key={category.id}
                  type="button"
                  className={category.id === activeCategoryId ? 'is-active' : ''}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  <span>{category.label}</span>
                  <em>{count}</em>
                </button>
              )
            })}
          </aside>

          <section className="prompt-assistant-results" aria-live="polite">
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <article key={item.id} className="prompt-assistant-card">
                  <div className="prompt-assistant-card-head">
                    <h3>{item.title}</h3>
                    <span>{promptAssistantCategories.find((category) => category.id === item.categoryId)?.label}</span>
                  </div>
                  <p>{item.prompt}</p>
                  <div className="prompt-assistant-tags">
                    {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <div className="prompt-assistant-card-actions">
                    <button type="button" onClick={() => onAppend(item.prompt)}>追加</button>
                    <button type="button" className="is-primary" onClick={() => onReplace(item.prompt)}>替换输入</button>
                  </div>
                </article>
              ))
            ) : (
              <div className="prompt-assistant-empty">没有匹配的提示词</div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
