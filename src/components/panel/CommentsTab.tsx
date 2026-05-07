'use client'

import { useEffect, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { getComments, addComment, deleteComment } from '@/lib/storage/extras'
import { getCurrentSession } from '@/lib/auth'
import type { ElementComment } from '@/types'

interface CommentsTabProps {
  projectId: string
  globalId:  string
}

export default function CommentsTab({ projectId, globalId }: CommentsTabProps) {
  const [comments, setComments] = useState<ElementComment[]>([])
  const [text,     setText]     = useState('')

  useEffect(() => {
    setComments(getComments(projectId, globalId))
  }, [projectId, globalId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    const author = getCurrentSession()?.username ?? 'anônimo'
    addComment(projectId, globalId, author, trimmed)
    setComments(getComments(projectId, globalId))
    setText('')
  }

  function handleDelete(id: string) {
    deleteComment(projectId, id)
    setComments(getComments(projectId, globalId))
  }

  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <div className="flex-1 overflow-auto space-y-2">
        {comments.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">
            Nenhum comentário ainda. Seja o primeiro a comentar.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-lg p-2.5 group">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(c.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{c.text}</p>
              <button onClick={() => handleDelete(c.id)}
                aria-label="Apagar comentário"
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition mt-1 text-xs flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> apagar
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escrever comentário…"
          rows={2}
          aria-label="Novo comentário"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button type="submit" disabled={!text.trim()}
          aria-label="Enviar comentário"
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 rounded-lg flex items-center justify-center">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
