import { useMemo } from 'react'
import { useStickyState } from '../../../hooks/useStickyState'
import {
    SidebarPanel,
    ContentPanel,
    ScrollList,
    SectionHeader,
    ListItem,
    EntityIcon,
} from '../../ui'
import { filterItems } from '../../../utils/databaseApi'
import { useFactions } from '../../../hooks/queries/factions'

// Faction side colors
const getSideInfo = (side) => {
    const sides = {
        1: { label: 'A', color: '#0070DE', name: '联盟' },
        2: { label: 'H', color: '#C41F3B', name: '部落' },
    }
    return sides[side] || { label: 'N', color: '#FFD100', name: '中立' }
}

function FactionsTab({ onNavigate }) {
    const [selectedGroup, setSelectedGroup] = useStickyState('factions.selectedGroup', null)

    const [groupFilter, setGroupFilter] = useStickyState('factions.groupFilter', '')
    const [factionFilter, setFactionFilter] = useStickyState('factions.factionFilter', '')

    // All factions load once (static for a session); groups + filtering derive.
    const { data: factions = [], isLoading } = useFactions()

    // Derive Groups from data
    const groups = useMemo(() => {
        if (factions.length === 0) return []

        const map = new Map(factions.map((f) => [f.id, f]))
        const parentIds = new Set(factions.map((f) => f.categoryId).filter((id) => id !== 0))

        const g = Array.from(parentIds)
            .map((id) => {
                const parent = map.get(id)
                return {
                    id: id,
                    name: parent ? parent.name : `分组 ${id}`,
                }
            })
            .sort((a, b) => a.name.localeCompare(b.name))

        const hasOrphans = factions.some((f) => f.categoryId === 0 && !parentIds.has(f.id))
        if (hasOrphans) {
            g.push({ id: 0, name: '其他' })
        }

        return g
    }, [factions])

    const filteredGroups = useMemo(() => filterItems(groups, groupFilter), [groups, groupFilter])

    const filteredFactions = useMemo(() => {
        if (!selectedGroup) return []

        let subset = []
        if (selectedGroup.id === 0) {
            const parentIds = new Set(factions.map((f) => f.categoryId))
            subset = factions.filter((f) => f.categoryId === 0 && !parentIds.has(f.id))
        } else {
            subset = factions.filter((f) => f.categoryId === selectedGroup.id)
        }

        return filterItems(subset, factionFilter)
    }, [factions, selectedGroup, factionFilter])

    return (
        <>
            {/* Groups */}
            <SidebarPanel className="col-span-1">
                <SectionHeader
                    title={`阵营分组 (${filteredGroups.length})`}
                    placeholder="筛选分组..."
                    onFilterChange={setGroupFilter}
                />
                <ScrollList>
                    {filteredGroups.map((group) => (
                        <ListItem
                            key={group.id}
                            active={selectedGroup?.id === group.id}
                            onClick={() => {
                                setSelectedGroup(group)
                                setFactionFilter('')
                            }}
                        >
                            {group.name}
                        </ListItem>
                    ))}
                </ScrollList>
            </SidebarPanel>

            {/* Factions List */}
            <ContentPanel className="col-span-3">
                <SectionHeader
                    title={
                        selectedGroup
                            ? `${selectedGroup.name} (${filteredFactions.length})`
                            : '请选择分组'
                    }
                    placeholder="筛选阵营..."
                    onFilterChange={setFactionFilter}
                    titleColor="#FFD100"
                />

                {isLoading && selectedGroup && (
                    <div className="flex flex-1 animate-pulse items-center justify-center italic text-wow-gold">
                        加载阵营中...
                    </div>
                )}

                {selectedGroup && !isLoading && (
                    <ScrollList className="space-y-1 p-2">
                        {filteredFactions.map((faction) => {
                            const sideInfo = getSideInfo(faction.side)

                            return (
                                <div
                                    key={faction.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-r border-l-[3px] bg-white/[0.02] p-2 transition-colors hover:bg-white/5"
                                    style={{ borderLeftColor: sideInfo.color }}
                                    onClick={() => onNavigate?.('faction', faction.id)}
                                >
                                    {/* Icon */}
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-700/50 bg-gray-900 p-1">
                                        {faction.side === 1 && (
                                            <img
                                                src="/Alliance_15.webp"
                                                alt="联盟"
                                                className="h-full w-full object-contain"
                                            />
                                        )}
                                        {faction.side === 2 && (
                                            <img
                                                src="/Horde_15.webp"
                                                alt="部落"
                                                className="h-full w-full object-contain"
                                            />
                                        )}
                                        {faction.side !== 1 && faction.side !== 2 && (
                                            <img
                                                src="/Neutral_15.webp"
                                                alt="中立"
                                                className="h-full w-full object-contain"
                                            />
                                        )}
                                    </div>

                                    <span className="min-w-[50px] font-mono text-[11px] text-gray-600">
                                        [{faction.id}]
                                    </span>

                                    <span
                                        className="flex-1 truncate font-bold"
                                        style={{ color: sideInfo.color }}
                                    >
                                        {faction.name}
                                    </span>

                                    <span className="ml-auto text-xs text-gray-500">
                                        {faction.sideName || sideInfo.name}
                                    </span>
                                </div>
                            )
                        })}
                    </ScrollList>
                )}

                {!selectedGroup && !isLoading && (
                    <div className="flex flex-1 items-center justify-center italic text-gray-600">
                        选择一个阵营分组以查看声望
                    </div>
                )}
            </ContentPanel>
        </>
    )
}

export default FactionsTab
