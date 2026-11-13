/**
 * VaultPage – Main vault management interface.
 * Features: folder tree, tag filters, item list, detail panel,
 *   fuzzy search, bulk-select, DnD reordering.
 */
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  ShieldAlert,
  Clock,
  Copy,
  Wifi,
  Tag,
  FolderOpen,
  FolderClosed,
  CheckSquare,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { VaultItemCard } from '@/components/vault/VaultItemCard';
import { VaultItemDetail } from '@/components/vault/VaultItemDetail';
import { VaultItemForm } from '@/components/vault/VaultItemForm';
import { useVaultStore } from '@/stores/vaultStore';
import type {
  DecryptedVaultItem,
  Folder,
  ItemType,
} from '@/types/vault';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FilterKey =
  | 'all'
  | 'favorites'
  | 'weak'
  | 'reused'
  | 'old'
  | 'breached'
  | 'trash';

type SortKey = 'alpha' | 'recent' | 'lastUsed' | 'created';

type ItemTypeFilter = 'all' | ItemType;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fuzzyMatch(item: DecryptedVaultItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const data = item.decryptedData as Record<string, unknown>;
  const haystack = [
    data['title'],
    data['username'],
    data['email'],
    data['ssid'],
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function applyFilter(
  items: DecryptedVaultItem[],
  filter: FilterKey,
): DecryptedVaultItem[] {
  switch (filter) {
    case 'favorites':
      return items.filter((i) => i.is_favorite && !i.is_deleted);
    case 'weak':
      return items.filter((i) => i.isWeak && !i.is_deleted);
    case 'reused':
      return items.filter((i) => i.isReused && !i.is_deleted);
    case 'old':
      return items.filter((i) => i.isOld && !i.is_deleted);
    case 'breached':
      return items.filter((i) => i.isBreached && !i.is_deleted);
    case 'trash':
      return items.filter((i) => i.is_deleted);
    default:
      return items.filter((i) => !i.is_deleted);
  }
}

function sortItems(
  items: DecryptedVaultItem[],
  sort: SortKey,
): DecryptedVaultItem[] {
  const copy = [...items];
  switch (sort) {
    case 'recent':
      return copy.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    case 'lastUsed':
      return copy.sort(
        (a, b) =>
          new Date(b.last_used_at ?? 0).getTime() -
          new Date(a.last_used_at ?? 0).getTime(),
      );
    case 'created':
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    default:
      return copy.sort((a, b) => {
        const aTitle = (a.decryptedData as Record<string, unknown>)[
          'title'
        ] as string;
        const bTitle = (b.decryptedData as Record<string, unknown>)[
          'title'
        ] as string;
        return (aTitle ?? '').localeCompare(bTitle ?? '');
      });
  }
}

// ---------------------------------------------------------------------------
// Sidebar filters
// ---------------------------------------------------------------------------
interface SidebarProps {
  folders: Folder[];
  tags: string[];
  activeFilter: FilterKey;
  activeFolderId: string | null;
  activeTag: string | null;
  onFilterChange: (f: FilterKey) => void;
  onFolderChange: (id: string | null) => void;
  onTagChange: (tag: string | null) => void;
  counts: Record<FilterKey, number>;
}

function Sidebar({
  folders,
  tags,
  activeFilter,
  activeFolderId,
  activeTag,
  onFilterChange,
  onFolderChange,
  onTagChange,
  counts,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filters: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All Items', icon: <Copy className="h-4 w-4" /> },
    { key: 'favorites', label: 'Favorites', icon: <Star className="h-4 w-4" /> },
    {
      key: 'weak',
      label: 'Weak',
      icon: <ShieldAlert className="h-4 w-4 text-orange-500" />,
    },
    {
      key: 'reused',
      label: 'Reused',
      icon: <RefreshCw className="h-4 w-4 text-yellow-500" />,
    },
    {
      key: 'old',
      label: 'Old (>90d)',
      icon: <Clock className="h-4 w-4 text-blue-500" />,
    },
    {
      key: 'breached',
      label: 'Breached',
      icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
    },
    {
      key: 'trash',
      label: 'Trash',
      icon: <Trash2 className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  const rootFolders = folders.filter((f) => !f.parent_id);
  const childMap = useMemo(() => {
    const m: Record<string, Folder[]> = {};
    folders.forEach((f) => {
      if (f.parent_id) {
        m[f.parent_id] = [...(m[f.parent_id] ?? []), f];
      }
    });
    return m;
  }, [folders]);

  const renderFolder = (folder: Folder, depth = 0) => {
    const children = childMap[folder.id] ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isActive = activeFolderId === folder.id;

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            if (hasChildren) toggleFolder(folder.id);
            onFolderChange(isActive ? null : folder.id);
          }}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted ${
            isActive ? 'bg-primary/10 text-primary font-medium' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0" />
            ) : (
              <FolderClosed className="h-4 w-4 shrink-0" />
            )
          ) : (
            <FolderClosed className="h-4 w-4 shrink-0 opacity-50" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="p-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Filters
        </p>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5">
          {filters.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => {
                onFilterChange(key);
                onFolderChange(null);
                onTagChange(null);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted ${
                activeFilter === key && !activeFolderId && !activeTag
                  ? 'bg-primary/10 text-primary font-medium'
                  : ''
              }`}
            >
              <span className="flex items-center gap-2">
                {icon} {label}
              </span>
              {counts[key] > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {counts[key]}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {folders.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Folders
            </p>
            <div className="space-y-0.5">
              {rootFolders.map((f) => renderFolder(f))}
            </div>
          </>
        )}

        {tags.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Tags
            </p>
            <div className="flex flex-wrap gap-1 px-3">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagChange(activeTag === tag ? null : tag)}
                  className="focus:outline-none"
                >
                  <Badge
                    variant={activeTag === tag ? 'default' : 'outline'}
                    className="cursor-pointer gap-1 text-xs"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </Badge>
                </button>
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, { title: string; desc: string }> = {
    all: {
      title: 'Your vault is empty',
      desc: 'Add your first item to get started.',
    },
    favorites: {
      title: 'No favorites yet',
      desc: 'Star items to quickly find them here.',
    },
    weak: {
      title: 'All passwords are strong!',
      desc: 'Great job keeping your credentials secure.',
    },
    reused: {
      title: 'No reused passwords',
      desc: 'Excellent — every account has a unique password.',
    },
    old: {
      title: 'No outdated passwords',
      desc: 'All your passwords are up to date.',
    },
    breached: {
      title: 'No breached passwords',
      desc: "None of your passwords appear in known breaches.",
    },
    trash: {
      title: 'Trash is empty',
      desc: 'Deleted items will appear here.',
    },
  };
  const { title, desc } = messages[filter];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Bulk action toolbar
// ---------------------------------------------------------------------------
interface BulkToolbarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onMoveSelected: () => void;
  onFavoriteSelected: () => void;
}

function BulkToolbar({
  selectedIds,
  onClearSelection,
  onDeleteSelected,
  onMoveSelected,
  onFavoriteSelected,
}: BulkToolbarProps) {
  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      className="flex items-center gap-3 border-b border-border bg-primary/5 px-4 py-2"
    >
      <span className="text-sm font-medium">
        {selectedIds.size} selected
      </span>
      <Button size="sm" variant="ghost" onClick={onFavoriteSelected}>
        <Star className="mr-1 h-4 w-4" />
        Favorite
      </Button>
      <Button size="sm" variant="ghost" onClick={onMoveSelected}>
        <FolderOpen className="mr-1 h-4 w-4" />
        Move
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={onDeleteSelected}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onClearSelection} className="ml-auto">
        <X className="mr-1 h-4 w-4" />
        Cancel
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// Mock data for demonstration — replace with real store hooks
const MOCK_FOLDERS: Folder[] = [
  {
    id: 'f1',
    name: 'Personal',
    parent_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f2',
    name: 'Work',
    parent_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f3',
    name: 'Dev Tools',
    parent_id: 'f2',
    created_at: new Date().toISOString(),
  },
];

const MOCK_ITEMS: DecryptedVaultItem[] = [];

export function VaultPage() {
  const store = useVaultStore();
  // ---- State ----
  const [items, setItems] = useState<DecryptedVaultItem[]>(store.items.length > 0 ? store.items : MOCK_ITEMS);
  const folders = store.folders.length > 0 ? store.folders : MOCK_FOLDERS;

  useEffect(() => {
    if (store.items.length > 0) {
      setItems(store.items);
    }
  }, [store.items]);

  useEffect(() => {
    if (store.activeItemId) {
      const found = items.find((i) => i.id === store.activeItemId);
      if (found) setSelectedItem(found);
    }
  }, [store.activeItemId, items]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('alpha');
  const [selectedItem, setSelectedItem] = useState<DecryptedVaultItem | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<DecryptedVaultItem | null>(
    null,
  );

  const searchRef = useRef<HTMLInputElement>(null);

  // ---- Keyboard shortcut (Ctrl+F) ----
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ---- Derived tags ----
  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.tags ?? []))),
    [items],
  );

  // ---- Counts for sidebar ----
  const counts = useMemo<Record<FilterKey, number>>(() => {
    const all = items.filter((i) => !i.is_deleted);
    return {
      all: all.length,
      favorites: all.filter((i) => i.is_favorite).length,
      weak: all.filter((i) => i.isWeak).length,
      reused: all.filter((i) => i.isReused).length,
      old: all.filter((i) => i.isOld).length,
      breached: all.filter((i) => i.isBreached).length,
      trash: items.filter((i) => i.is_deleted).length,
    };
  }, [items]);

  // ---- Filtered + sorted list ----
  const displayedItems = useMemo(() => {
    let result = applyFilter(items, activeFilter);

    if (activeFolderId) {
      result = result.filter((i) => i.folder_id === activeFolderId);
    }
    if (activeTag) {
      result = result.filter((i) => i.tags?.includes(activeTag));
    }
    if (typeFilter !== 'all') {
      result = result.filter((i) => i.type === typeFilter);
    }
    result = result.filter((i) => fuzzyMatch(i, searchQuery));
    return sortItems(result, sortKey);
  }, [
    items,
    activeFilter,
    activeFolderId,
    activeTag,
    typeFilter,
    searchQuery,
    sortKey,
  ]);

  // ---- DnD sensors ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setItems((prev) => {
        const oldIdx = prev.findIndex((i) => i.id === active.id);
        const newIdx = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    },
    [],
  );

  // ---- Bulk actions ----
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    setItems((prev) =>
      prev.map((i) =>
        selectedIds.has(i.id) ? { ...i, is_deleted: true } : i,
      ),
    );
    setSelectedIds(new Set());
    setIsBulkMode(false);
  };

  const handleFavoriteSelected = () => {
    setItems((prev) =>
      prev.map((i) =>
        selectedIds.has(i.id) ? { ...i, is_favorite: true } : i,
      ),
    );
    setSelectedIds(new Set());
    setIsBulkMode(false);
  };

  // ---- Add/Edit/Delete handlers ----
  const handleSaveItem = (item: DecryptedVaultItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
    setShowAddForm(false);
    setEditingItem(null);
    setSelectedItem(item);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_deleted: true } : i)),
    );
    if (selectedItem?.id === id) setSelectedItem(null);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search vault… (Ctrl+F)"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as ItemTypeFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="note">Secure Note</SelectItem>
            <SelectItem value="card">Credit Card</SelectItem>
            <SelectItem value="identity">Identity</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
            <SelectItem value="wifi">Wi-Fi</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger className="w-36">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpha">A → Z</SelectItem>
            <SelectItem value="recent">Recently updated</SelectItem>
            <SelectItem value="lastUsed">Last used</SelectItem>
            <SelectItem value="created">Date created</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk mode toggle */}
        <Button
          variant={isBulkMode ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => {
            setIsBulkMode((v) => !v);
            setSelectedIds(new Set());
          }}
          title="Bulk select mode"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          folders={folders}
          tags={allTags}
          activeFilter={activeFilter}
          activeFolderId={activeFolderId}
          activeTag={activeTag}
          onFilterChange={(f) => {
            setActiveFilter(f);
            setActiveFolderId(null);
            setActiveTag(null);
            setSelectedItem(null);
          }}
          onFolderChange={(id) => {
            setActiveFolderId(id);
            setActiveFilter('all');
            setSelectedItem(null);
          }}
          onTagChange={(tag) => {
            setActiveTag(tag);
            setActiveFilter('all');
            setSelectedItem(null);
          }}
          counts={counts}
        />

        {/* Item list */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AnimatePresence>
            {isBulkMode && selectedIds.size > 0 && (
              <BulkToolbar
                selectedIds={selectedIds}
                onClearSelection={() => {
                  setSelectedIds(new Set());
                  setIsBulkMode(false);
                }}
                onDeleteSelected={handleDeleteSelected}
                onMoveSelected={() => {
                  /* TODO: open move modal */
                }}
                onFavoriteSelected={handleFavoriteSelected}
              />
            )}
          </AnimatePresence>

          <ScrollArea className="flex-1 px-4 py-3">
            {displayedItems.length === 0 ? (
              <EmptyState filter={activeFilter} />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayedItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <motion.div
                    className="space-y-1.5"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: { staggerChildren: 0.04 },
                      },
                      hidden: {},
                    }}
                  >
                    {displayedItems.map((item, index) => (
                      <VaultItemCard
                        key={item.id || `local-item-${index}`}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        isActive={selectedItem?.id === item.id}
                        isBulkMode={isBulkMode}
                        onSelect={() => {
                          if (isBulkMode) {
                            toggleSelect(item.id);
                          } else {
                            setSelectedItem(
                              selectedItem?.id === item.id ? null : item,
                            );
                          }
                        }}
                        onEdit={() => setEditingItem(item)}
                        onDelete={() => handleDeleteItem(item.id)}
                        onToggleFavorite={() =>
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, is_favorite: !i.is_favorite }
                                : i,
                            ),
                          )
                        }
                        onDuplicate={() => {
                          const clone: DecryptedVaultItem = {
                            ...item,
                            id: crypto.randomUUID(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            last_used_at: null,
                          };
                          setItems((prev) => [clone, ...prev]);
                        }}
                      />
                    ))}
                  </motion.div>
                </SortableContext>
              </DndContext>
            )}
          </ScrollArea>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedItem && !showAddForm && !editingItem && (
            <VaultItemDetail
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onEdit={() => setEditingItem(selectedItem)}
              onDelete={() => handleDeleteItem(selectedItem.id)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setShowAddForm(true);
          setEditingItem(null);
          setSelectedItem(null);
        }}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Add new item"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {(showAddForm || editingItem) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAddForm(false);
                setEditingItem(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-2xl rounded-xl bg-background shadow-2xl"
            >
              <VaultItemForm
                item={editingItem ?? undefined}
                folders={folders}
                onSave={handleSaveItem}
                onCancel={() => {
                  setShowAddForm(false);
                  setEditingItem(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
