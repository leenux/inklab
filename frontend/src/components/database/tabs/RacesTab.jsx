import { useMemo } from 'react'
import { useStickyState } from '../../../hooks/useStickyState'
import { SidebarPanel, ContentPanel, ScrollList, SectionHeader, ListItem } from '../../ui'
import { filterItems } from '../../../utils/databaseApi'
import { useRaces } from '../../../hooks/queries/races'
import { useIcon, useImage } from '../../../services/useImage'
import { QUESTION_MARK_ICON } from '../../../utils/wow.ts'

const FACTION_COLOR = { Alliance: '#3b82f6', Horde: '#e0294a', 联盟: '#3b82f6', 部落: '#e0294a' }
const FACTION_LABEL = { Alliance: '联盟', Horde: '部落', Neutral: '中立' }
const factionColor = (f) => FACTION_COLOR[f] || '#FFD100'

const iconKey = (fileString, gender) => `${(fileString || '').toLowerCase()}_${gender}`

// A race/gender portrait cropped from the client character-create sprite sheet.
function RaceGenderIcon({ fileString, gender, size = 'lg' }) {
    const { src } = useImage('race_icon', iconKey(fileString, gender))
    if (!src) return null
    const box = size === 'lg' ? 'w-14 h-14' : 'w-6 h-6'
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`${box} overflow-hidden rounded border border-border-dark bg-black`}>
                <img
                    src={src}
                    alt={gender}
                    className="h-full w-full object-cover"
                    draggable={false}
                />
            </div>
        </div>
    )
}

// One racial ability resolved to a real spell — clickable through to its page,
// with a spell tooltip on hover.
function RacialSpell({ spell, onNavigate, tooltipHook }) {
    const icon = useIcon(spell.icon)
    return (
        <button
            onClick={() => onNavigate?.('spell', spell.id)}
            {...(tooltipHook?.getSpellHandlers?.(spell.id) || {})}
            className="flex items-center gap-2 rounded border border-border-dark/50 bg-white/[0.02] p-2 text-left transition-colors hover:bg-white/5"
        >
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-gray-700/50 bg-black">
                <img
                    src={icon.src || QUESTION_MARK_ICON}
                    alt=""
                    className="h-full w-full object-cover"
                />
            </div>
            <span className="truncate text-sm font-semibold text-wow-rare">{spell.name}</span>
            <span className="ml-auto font-mono text-[11px] text-gray-600">#{spell.id}</span>
        </button>
    )
}

function RacesTab({ onNavigate, tooltipHook }) {
    const { data: races = [], isLoading } = useRaces()
    const [selectedId, setSelectedId] = useStickyState('races.selectedId', null)
    const [filter, setFilter] = useStickyState('races.filter', '')

    const filtered = useMemo(() => filterItems(races, filter), [races, filter])
    // Default to the first race (derived, no effect).
    const selected = races.find((r) => r.id === selectedId) || filtered[0] || null

    return (
        <>
            {/* Race list */}
            <SidebarPanel className="col-span-1">
                <SectionHeader
                    title={`种族 (${filtered.length})`}
                    placeholder="筛选种族..."
                    onFilterChange={setFilter}
                />
                <ScrollList>
                    {filtered.map((race) => (
                        <ListItem
                            key={race.id}
                            active={selected?.id === race.id}
                            onClick={() => setSelectedId(race.id)}
                        >
                            <span className="flex items-center gap-2">
                                <RaceGenderIcon
                                    fileString={race.fileString}
                                    gender="male"
                                    size="sm"
                                />
                                <span
                                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ background: factionColor(race.faction) }}
                                />
                                {race.name}
                            </span>
                        </ListItem>
                    ))}
                </ScrollList>
            </SidebarPanel>

            {/* Race detail */}
            <ContentPanel className="col-span-3">
                {isLoading ? (
                    <div className="flex flex-1 animate-pulse items-center justify-center italic text-wow-gold">
                        加载种族中...
                    </div>
                ) : !selected ? (
                    <div className="flex flex-1 items-center justify-center italic text-gray-600">
                        暂无种族数据。请运行客户端数据导入以填充种族。
                    </div>
                ) : (
                    <ScrollList className="space-y-7 p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-baseline gap-3">
                                <h2
                                    className="text-2xl font-bold"
                                    style={{ color: factionColor(selected.faction) }}
                                >
                                    {selected.name}
                                </h2>
                                {selected.faction && (
                                    <span
                                        className="rounded px-2 py-0.5 text-[11px] font-bold uppercase"
                                        style={{
                                            background: `${factionColor(selected.faction)}22`,
                                            color: factionColor(selected.faction),
                                        }}
                                    >
                                        {FACTION_LABEL[selected.faction] || selected.faction}
                                    </span>
                                )}
                            </div>
                            <div className="flex shrink-0 gap-3">
                                <RaceGenderIcon fileString={selected.fileString} gender="male" />
                                <RaceGenderIcon fileString={selected.fileString} gender="female" />
                            </div>
                        </div>

                        {/* Flavor text */}
                        {selected.info && (
                            <p className="text-sm italic leading-relaxed text-gray-300">
                                {selected.info}
                            </p>
                        )}

                        {/* Available classes */}
                        {selected.classes?.length > 0 && (
                            <div>
                                <div className="mb-2 text-xs font-bold uppercase text-wow-gold">
                                    可选职业
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {selected.classes.map((c) => (
                                        <span
                                            key={c.id}
                                            className="rounded border bg-white/[0.03] px-2.5 py-1 text-xs font-semibold"
                                            style={{
                                                color: c.color || '#e5e7eb',
                                                borderColor: c.color ? `${c.color}66` : undefined,
                                            }}
                                        >
                                            {c.name || `职业 ${c.id}`}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Racial traits (flavor blurbs) */}
                        {selected.abilities?.length > 0 && (
                            <div>
                                <div className="mb-2 text-xs font-bold uppercase text-wow-gold">
                                    种族特性
                                </div>
                                <ul className="space-y-1 text-sm text-gray-300">
                                    {selected.abilities.map((a, i) => (
                                        <li key={i} className="leading-snug">
                                            {a}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Racial abilities (linked spells) */}
                        <div>
                            <div className="mb-2 text-xs font-bold uppercase text-wow-gold">
                                种族技能
                            </div>
                            {selected.racials?.length > 0 ? (
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    {selected.racials.map((s) => (
                                        <RacialSpell
                                            key={s.id}
                                            spell={s}
                                            onNavigate={onNavigate}
                                            tooltipHook={tooltipHook}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs italic leading-relaxed text-gray-500">
                                    该种族没有关联的种族法术 — Turtle 开发者从未在客户端数据中把该种族的技能线关联到任何法术，
                                    因此无处可指。上方的特性是创建角色时的介绍文字。如果 Octo/Capy
                                    开发者日后修复，重新导入客户端数据即可在此处显示。
                                </p>
                            )}
                        </div>
                    </ScrollList>
                )}
            </ContentPanel>
        </>
    )
}

export default RacesTab
