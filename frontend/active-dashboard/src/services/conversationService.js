/**
 * Conversation Service — API client for infrastructure chat conversation management.
 * Communicates directly with infrastructure-service (bypasses gateway for SSE compatibility).
 */

import { getToken } from './authService'

const INFRA_API_URL = import.meta.env.VITE_INFRA_API_BASE_URL || 'http://localhost:8004'

/**
 * List all conversations for a project.
 * @param {string} projectId
 * @returns {Promise<Array>} conversations
 */
export const getConversations = async (projectId) => {
  const token = getToken()
  if (!token) throw new Error('Authentication required')

  const params = new URLSearchParams({ project_id: projectId, token })
  const response = await fetch(`${INFRA_API_URL}/api/infra/conversations?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to load conversations: ${response.status}`)
  }

  const data = await response.json()
  return data.conversations || []
}

/**
 * Load messages for a specific conversation.
 * @param {string} sessionId
 * @param {number} limit
 * @returns {Promise<{session_id: string, title: string, messages: Array}>}
 */
export const getConversationMessages = async (sessionId, limit = 50) => {
  const token = getToken()
  if (!token) throw new Error('Authentication required')

  const params = new URLSearchParams({ token, limit: String(limit) })
  const response = await fetch(
    `${INFRA_API_URL}/api/infra/conversations/${encodeURIComponent(sessionId)}/messages?${params}`
  )

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Failed to load messages: ${response.status}`)
  }

  return await response.json()
}

/**
 * Delete a conversation.
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export const deleteConversation = async (sessionId) => {
  const token = getToken()
  if (!token) throw new Error('Authentication required')

  const params = new URLSearchParams({ token })
  const response = await fetch(
    `${INFRA_API_URL}/api/infra/conversations/${encodeURIComponent(sessionId)}?${params}`,
    { method: 'DELETE' }
  )

  return response.ok
}

/**
 * Rename a conversation.
 * @param {string} sessionId
 * @param {string} title
 * @returns {Promise<boolean>}
 */
export const renameConversation = async (sessionId, title) => {
  const token = getToken()
  if (!token) throw new Error('Authentication required')

  const params = new URLSearchParams({ token })
  const response = await fetch(
    `${INFRA_API_URL}/api/infra/conversations/${encodeURIComponent(sessionId)}/title?${params}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }
  )

  return response.ok
}

/**
 * Fetch deleted infrastructure history for a project.
 * @param {string} projectId
 * @returns {Promise<{has_history: boolean, history: object|null}>}
 */
export const getDeletedInfraHistory = async (projectId) => {
  const token = getToken()
  if (!token) throw new Error('Authentication required')

  const params = new URLSearchParams({ token })
  const response = await fetch(
    `${INFRA_API_URL}/api/infra/deleted-history/${encodeURIComponent(projectId)}?${params}`
  )

  if (!response.ok) {
    if (response.status === 404) return { has_history: false, history: null }
    throw new Error(`Failed to load deleted infra history: ${response.status}`)
  }

  return await response.json()
}

