'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AssistantMessage {
  role: string;
  content: string;
}

interface AssistantConversation {
  id: string;
  conversation_id: string;
  user_id: string | null;
  title: string;
  summary: string | null;
  messages: AssistantMessage[];
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function AssistantConversationsDashboard() {
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<AssistantConversation | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('assistant_conversations')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `title.ilike.%${search.trim()}%,user_id.ilike.%${search.trim()}%,summary.ilike.%${search.trim()}%`
        );
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setConversations(data || []);
      setTotalCount(count || 0);
    } catch (e: any) {
      setError(e.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchConversations();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Assistant Conversations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All synced AI paralegal chat sessions, lead metadata, and interaction history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full font-medium">
            {totalCount} total
          </span>
          <button
            onClick={fetchConversations}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, user ID, or summary…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setPage(0); }}
            className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Main layout: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Conversation List */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-3">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="text-sm font-medium text-foreground">No conversations found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try a different search term' : 'Conversations will appear here once synced'}
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedConversation?.id === conv.id
                    ? 'border-foreground bg-foreground/5'
                    : 'border-border hover:border-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground line-clamp-1 flex-1">{conv.title}</p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {conv.user_id && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                    User: {conv.user_id}
                  </p>
                )}
                {conv.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{conv.summary}</p>
                )}
                <p className="text-xs text-muted-foreground/60 mt-2">{formatDate(conv.updated_at)}</p>
              </button>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Prev
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-3">
          {!selectedConversation ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] border border-dashed border-border rounded-xl text-center p-8">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-3">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="text-sm text-muted-foreground">Select a conversation to view details</p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{selectedConversation.title}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                      ID: {selectedConversation.conversation_id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-background rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">User ID</p>
                    <p className="text-xs text-foreground font-mono truncate">{selectedConversation.user_id || '—'}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Messages</p>
                    <p className="text-xs text-foreground font-semibold">{selectedConversation.message_count}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Created</p>
                    <p className="text-xs text-foreground">{formatDate(selectedConversation.created_at)}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Last Updated</p>
                    <p className="text-xs text-foreground">{formatDate(selectedConversation.updated_at)}</p>
                  </div>
                </div>

                {selectedConversation.summary && (
                  <div className="mt-3 bg-background rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Summary</p>
                    <p className="text-xs text-foreground leading-relaxed">{selectedConversation.summary}</p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Interaction History ({selectedConversation.messages?.length || 0} messages)
                </p>
                {!selectedConversation.messages || selectedConversation.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No messages recorded</p>
                ) : (
                  selectedConversation.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                          msg.role === 'user' ?'bg-foreground text-background' :'bg-accent/20 text-accent-foreground'
                        }`}
                      >
                        {msg.role === 'user' ? 'U' : 'A'}
                      </div>
                      <div
                        className={`flex-1 max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === 'user' ?'bg-foreground text-background' :'bg-muted text-foreground'
                        }`}
                      >
                        <span className="block font-medium mb-0.5 opacity-60 uppercase tracking-wide text-[10px]">
                          {msg.role}
                        </span>
                        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
