import { SidebarPanel } from '../../ui'
import { getQualityColor } from '../../../utils/wow.ts'

// Wowhead-style filter sidebar for the Items page. Purely controlled: it reads
// the current `filter` (a models.SearchFilter shape) and emits partial patches
// via onChange — the parent merges them and resets paging. Reference data (item
// class hierarchy, stat types, player classes) is passed in.

const QUALITIES = [
    { id: 0, name: '粗糙' },
    { id: 1, name: '普通' },
    { id: 2, name: '优秀' },
    { id: 3, name: '精良' },
    { id: 4, name: '史诗' },
    { id: 5, name: '传说' },
]

const SOURCES = [
    { key: 'drop', name: '掉落' },
    { key: 'object', name: '物体' },
    { key: 'container', name: '容器' },
    { key: 'vendor', name: '商人' },
    { key: 'quest', name: '任务' },
    { key: 'crafted', name: '制造' },
    { key: 'disenchant', name: '分解' },
]

const BONDINGS = [
    { id: 1, name: '拾取绑定' },
    { id: 2, name: '装备绑定' },
    { id: 3, name: '使用绑定' },
    { id: 4, name: '任务' },
]

// Damage schools (dmg_type1). 0 = any (Physical, the common default).
const DAMAGE_SCHOOLS = [
    { id: 0, name: '任意' },
    { id: 1, name: '神圣' },
    { id: 2, name: '火焰' },
    { id: 3, name: '自然' },
    { id: 4, name: '冰霜' },
    { id: 5, name: '暗影' },
    { id: 6, name: '奥术' },
]

const RESIST_SCHOOLS = [
    { id: 1, name: '神圣' },
    { id: 2, name: '火焰' },
    { id: 3, name: '自然' },
    { id: 4, name: '冰霜' },
    { id: 5, name: '暗影' },
    { id: 6, name: '奥术' },
]

const toggle = (arr, val) =>
    (arr || []).includes(val) ? arr.filter((v) => v !== val) : [...(arr || []), val]

const SELECT_CLS =
    'w-full rounded border border-gray-700 bg-black/40 px-2 py-1 text-xs text-white ' +
    'focus:border-wow-gold focus:outline-none'
const NUM_CLS =
    'w-full rounded border border-gray-700 bg-black/40 px-2 py-1 text-xs text-white ' +
    'focus:border-wow-gold focus:outline-none [appearance:textfield] ' +
    '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

const num = (v) => {
    const n = parseInt(v, 10)
    return isNaN(n) || n < 0 ? 0 : n
}
const fnum = (v) => {
    const n = parseFloat(v)
    return isNaN(n) || n < 0 ? 0 : n
}

// One labelled filter block.
function Field({ label, children }) {
    return (
        <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
            </div>
            {children}
        </div>
    )
}

// A bold section divider.
function Group({ title, children }) {
    return (
        <div className="space-y-3 border-t border-white/10 pt-3">
            <div className="text-xs font-bold uppercase tracking-wide text-wow-gold/80">
                {title}
            </div>
            {children}
        </div>
    )
}

// A min–max pair of number inputs.
function Range({ label, min, max, onMin, onMax, step }) {
    return (
        <Field label={label}>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min="0"
                    step={step}
                    value={min || ''}
                    onChange={(e) => onMin(e.target.value)}
                    placeholder="最小"
                    className={NUM_CLS}
                />
                <span className="text-gray-600">–</span>
                <input
                    type="number"
                    min="0"
                    step={step}
                    value={max || ''}
                    onChange={(e) => onMax(e.target.value)}
                    placeholder="最大"
                    className={NUM_CLS}
                />
            </div>
        </Field>
    )
}

// A checkbox toggle row.
function Toggle({ label, checked, onChange }) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-300">
            <input
                type="checkbox"
                checked={!!checked}
                onChange={(e) => onChange(e.target.checked)}
                className="accent-wow-gold"
            />
            {label}
        </label>
    )
}

export default function ItemBrowseFilters({
    filter,
    onChange,
    onReset,
    itemClasses = [],
    statTypes = [],
    playerClasses = [],
}) {
    const selClass = filter.class?.[0] ?? null
    const selSubClass = filter.subClass?.[0] ?? null
    const selSlot = filter.inventoryType?.[0] ?? null

    const classObj = itemClasses.find((c) => c.class === selClass) || null
    const subClasses = classObj?.subClasses || []
    const subObj = subClasses.find((s) => s.subClass === selSubClass) || null
    const slots = subObj?.inventorySlots || []

    return (
        <SidebarPanel>
            <div className="space-y-3 overflow-y-auto p-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-wow-gold">筛选</span>
                    <button
                        onClick={onReset}
                        className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400 hover:border-gray-500 hover:text-white"
                    >
                        重置
                    </button>
                </div>

                {/* Name / ID search */}
                <Field label="名称或 ID">
                    <input
                        type="text"
                        value={filter.query || ''}
                        onChange={(e) => onChange({ query: e.target.value })}
                        placeholder="搜索…"
                        className={SELECT_CLS}
                    />
                </Field>

                {/* Quality */}
                <Field label="品质">
                    <div className="flex flex-wrap gap-1">
                        {QUALITIES.map((q) => {
                            const on = (filter.quality || []).includes(q.id)
                            return (
                                <button
                                    key={q.id}
                                    onClick={() =>
                                        onChange({ quality: toggle(filter.quality, q.id) })
                                    }
                                    className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                                        on
                                            ? 'border-current'
                                            : 'border-transparent bg-black/30 hover:bg-white/5'
                                    }`}
                                    style={{ color: getQualityColor(q.id) }}
                                >
                                    {q.name}
                                </button>
                            )
                        })}
                    </div>
                </Field>

                {/* Class / subclass / slot */}
                <Field label="类型">
                    <select
                        value={selClass ?? ''}
                        onChange={(e) =>
                            onChange({
                                class: e.target.value === '' ? [] : [Number(e.target.value)],
                                subClass: [],
                                inventoryType: [],
                            })
                        }
                        className={SELECT_CLS}
                    >
                        <option value="">任意类型</option>
                        {itemClasses.map((c) => (
                            <option key={c.class} value={c.class}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    {subClasses.length > 0 && (
                        <select
                            value={selSubClass ?? ''}
                            onChange={(e) =>
                                onChange({
                                    subClass: e.target.value === '' ? [] : [Number(e.target.value)],
                                    inventoryType: [],
                                })
                            }
                            className={SELECT_CLS}
                        >
                            <option value="">任意子类型</option>
                            {subClasses.map((s) => (
                                <option key={s.subClass} value={s.subClass}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {slots.length > 0 && (
                        <select
                            value={selSlot ?? ''}
                            onChange={(e) =>
                                onChange({
                                    inventoryType:
                                        e.target.value === '' ? [] : [Number(e.target.value)],
                                })
                            }
                            className={SELECT_CLS}
                        >
                            <option value="">任意部位</option>
                            {slots.map((sl) => (
                                <option key={sl.inventoryType} value={sl.inventoryType}>
                                    {sl.name}
                                </option>
                            ))}
                        </select>
                    )}
                </Field>

                <Range
                    label="物品等级"
                    min={filter.minLevel}
                    max={filter.maxLevel}
                    onMin={(v) => onChange({ minLevel: num(v) })}
                    onMax={(v) => onChange({ maxLevel: num(v) })}
                />
                <Range
                    label="需要等级"
                    min={filter.minReqLevel}
                    max={filter.maxReqLevel}
                    onMin={(v) => onChange({ minReqLevel: num(v) })}
                    onMax={(v) => onChange({ maxReqLevel: num(v) })}
                />

                {/* Usable by class */}
                <Field label="可用职业">
                    <select
                        value={filter.usableByClass || 0}
                        onChange={(e) => onChange({ usableByClass: Number(e.target.value) })}
                        className={SELECT_CLS}
                    >
                        <option value={0}>任意职业</option>
                        {playerClasses.map((c) => (
                            <option key={c.classId} value={c.classId}>
                                {c.name || c.class}
                            </option>
                        ))}
                    </select>
                </Field>

                {/* ---- Item properties ---- */}
                <Group title="属性">
                    <Field label="绑定">
                        <div className="flex flex-wrap gap-1">
                            {BONDINGS.map((b) => {
                                const on = (filter.bonding || []).includes(b.id)
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() =>
                                            onChange({ bonding: toggle(filter.bonding, b.id) })
                                        }
                                        className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
                                            on
                                                ? 'border-wow-gold bg-wow-gold/20 text-wow-gold'
                                                : 'border-gray-700 bg-black/30 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {b.name}
                                    </button>
                                )
                            })}
                        </div>
                    </Field>
                    <Toggle
                        label="唯一"
                        checked={filter.onlyUnique}
                        onChange={(v) => onChange({ onlyUnique: v })}
                    />
                    <Toggle
                        label="职业专用"
                        checked={filter.classSpecific}
                        onChange={(v) => onChange({ classSpecific: v })}
                    />
                    <Toggle
                        label="种族专用"
                        checked={filter.raceSpecific}
                        onChange={(v) => onChange({ raceSpecific: v })}
                    />
                    <Toggle
                        label="开启任务"
                        checked={filter.startsQuest}
                        onChange={(v) => onChange({ startsQuest: v })}
                    />
                    <Toggle
                        label="有使用/装备效果"
                        checked={filter.hasEffect}
                        onChange={(v) => onChange({ hasEffect: v })}
                    />
                    <Toggle
                        label="有随机后缀"
                        checked={filter.hasRandomSuffix}
                        onChange={(v) => onChange({ hasRandomSuffix: v })}
                    />
                </Group>

                {/* ---- Requirements & economy ---- */}
                <Group title="需求与经济">
                    <Toggle
                        label="需要专业技能"
                        checked={filter.requiresProf}
                        onChange={(v) => onChange({ requiresProf: v })}
                    />
                    <Range
                        label="需要技能等级"
                        min={filter.minSkillRank}
                        max={filter.maxSkillRank}
                        onMin={(v) => onChange({ minSkillRank: num(v) })}
                        onMax={(v) => onChange({ maxSkillRank: num(v) })}
                    />
                    <Toggle
                        label="需要声望"
                        checked={filter.requiresRep}
                        onChange={(v) => onChange({ requiresRep: v })}
                    />
                    <Range
                        label="买入价（铜）"
                        min={filter.minBuyPrice}
                        max={filter.maxBuyPrice}
                        onMin={(v) => onChange({ minBuyPrice: num(v) })}
                        onMax={(v) => onChange({ maxBuyPrice: num(v) })}
                    />
                    <Range
                        label="卖出价（铜）"
                        min={filter.minSellPrice}
                        max={filter.maxSellPrice}
                        onMin={(v) => onChange({ minSellPrice: num(v) })}
                        onMax={(v) => onChange({ maxSellPrice: num(v) })}
                    />
                    <Range
                        label="耐久度"
                        min={filter.minDurability}
                        max={filter.maxDurability}
                        onMin={(v) => onChange({ minDurability: num(v) })}
                        onMax={(v) => onChange({ maxDurability: num(v) })}
                    />
                </Group>

                {/* ---- Weapon & armor stats ---- */}
                <Group title="武器与护甲">
                    <Range
                        label="武器 DPS"
                        step="0.1"
                        min={filter.minDps}
                        max={filter.maxDps}
                        onMin={(v) => onChange({ minDps: fnum(v) })}
                        onMax={(v) => onChange({ maxDps: fnum(v) })}
                    />
                    <Range
                        label="武器速度"
                        step="0.1"
                        min={filter.minSpeed}
                        max={filter.maxSpeed}
                        onMin={(v) => onChange({ minSpeed: fnum(v) })}
                        onMax={(v) => onChange({ maxSpeed: fnum(v) })}
                    />
                    <Field label="伤害类型">
                        <select
                            value={filter.damageSchool || 0}
                            onChange={(e) => onChange({ damageSchool: Number(e.target.value) })}
                            className={SELECT_CLS}
                        >
                            {DAMAGE_SCHOOLS.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Range
                        label="护甲"
                        min={filter.minArmor}
                        max={filter.maxArmor}
                        onMin={(v) => onChange({ minArmor: num(v) })}
                        onMax={(v) => onChange({ maxArmor: num(v) })}
                    />
                    <Range
                        label="格挡"
                        min={filter.minBlock}
                        max={filter.maxBlock}
                        onMin={(v) => onChange({ minBlock: num(v) })}
                        onMax={(v) => onChange({ maxBlock: num(v) })}
                    />
                    <Field label="抗性（最小）">
                        <div className="space-y-1">
                            {(filter.resists || []).map((row, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <select
                                        value={row.school}
                                        onChange={(e) => {
                                            const resists = [...filter.resists]
                                            resists[i] = { ...row, school: Number(e.target.value) }
                                            onChange({ resists })
                                        }}
                                        className={SELECT_CLS}
                                    >
                                        {RESIST_SCHOOLS.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min="0"
                                        value={row.min || ''}
                                        onChange={(e) => {
                                            const resists = [...filter.resists]
                                            resists[i] = { ...row, min: num(e.target.value) }
                                            onChange({ resists })
                                        }}
                                        placeholder="最小"
                                        className={`${NUM_CLS} w-16 flex-shrink-0`}
                                    />
                                    <button
                                        onClick={() =>
                                            onChange({
                                                resists: filter.resists.filter((_, j) => j !== i),
                                            })
                                        }
                                        className="flex-shrink-0 px-1 text-gray-500 hover:text-red-400"
                                        title="移除"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() =>
                                    onChange({
                                        resists: [...(filter.resists || []), { school: 2, min: 0 }],
                                    })
                                }
                                className="w-full rounded border border-dashed border-gray-700 px-2 py-1 text-[11px] text-gray-400 hover:border-gray-500 hover:text-white"
                            >
                                + 添加抗性
                            </button>
                        </div>
                    </Field>
                </Group>

                {/* ---- Stats ---- */}
                <Group title="属性（最小）">
                    <div className="space-y-1">
                        {(filter.stats || []).map((row, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <select
                                    value={row.stat}
                                    onChange={(e) => {
                                        const stats = [...filter.stats]
                                        stats[i] = { ...row, stat: Number(e.target.value) }
                                        onChange({ stats })
                                    }}
                                    className={SELECT_CLS}
                                >
                                    {statTypes.map((st) => (
                                        <option key={st.id} value={st.id}>
                                            {st.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    value={row.min || ''}
                                    onChange={(e) => {
                                        const stats = [...filter.stats]
                                        stats[i] = { ...row, min: num(e.target.value) }
                                        onChange({ stats })
                                    }}
                                    placeholder="最小"
                                    className={`${NUM_CLS} w-16 flex-shrink-0`}
                                />
                                <button
                                    onClick={() =>
                                        onChange({ stats: filter.stats.filter((_, j) => j !== i) })
                                    }
                                    className="flex-shrink-0 px-1 text-gray-500 hover:text-red-400"
                                    title="移除"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        {statTypes.length > 0 && (
                            <button
                                onClick={() =>
                                    onChange({
                                        stats: [
                                            ...(filter.stats || []),
                                            { stat: statTypes[0].id, min: 0 },
                                        ],
                                    })
                                }
                                className="w-full rounded border border-dashed border-gray-700 px-2 py-1 text-[11px] text-gray-400 hover:border-gray-500 hover:text-white"
                            >
                                + 添加属性
                            </button>
                        )}
                    </div>
                </Group>

                {/* ---- Source ---- */}
                <Group title="来源">
                    <div className="flex flex-wrap gap-1">
                        {SOURCES.map((s) => {
                            const on = (filter.sources || []).includes(s.key)
                            return (
                                <button
                                    key={s.key}
                                    onClick={() =>
                                        onChange({ sources: toggle(filter.sources, s.key) })
                                    }
                                    className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
                                        on
                                            ? 'border-wow-gold bg-wow-gold/20 text-wow-gold'
                                            : 'border-gray-700 bg-black/30 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {s.name}
                                </button>
                            )
                        })}
                    </div>
                </Group>
            </div>
        </SidebarPanel>
    )
}
