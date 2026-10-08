import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageLayout } from '../../components/ui'
import { useDataStatus, useWhatsNew, whatsNewQuery } from '../../hooks/queries/app'
import { DEFAULT_WOW_BASE } from '../../utils/constants'
import { useEntityNavigate } from '../../utils/entityNav'

const DEFAULT_BASE = DEFAULT_WOW_BASE

// Each importer maps to an App binding that takes the client base folder.
// requiresMysql: the importer reads the world DB, so it's hidden unless a MySQL
// connection exists — most users ship-install without one and could only ever
// get an "unavailable" report from it.
const IMPORTS = [
    {
        id: 'client',
        name: '客户端数据（图标、地图、DBC）',
        fn: 'RunClientImport',
        sub: 'Data\\*.MPQ（或松散的 DBFilesClient\\ + BlizzardInterfaceArt\\）',
        desc: '一次性处理你的 WoW 客户端：解码图标 → data/icons，构建完整揭示的区域地图 → data/maps，并将参考数据（区域、技能、任务分类、阵营、套装、法术文本）重新生成到数据库。存在 MPQ 归档时直接在内存中读取（不会写回任何内容）。',
    },
    {
        id: 'cache',
        name: 'WDB 缓存',
        fn: 'RunCacheImport',
        sub: 'WDB\\*.wdb',
        desc: '从客户端的 WDB 缓存中补全物品 / 任务 / 生物 / 游戏物体数据 — 即你在游戏中查询过的所有内容。会覆盖为服务器上最新的值；现有数据不会被清除。',
    },
    {
        id: 'spawnZones',
        name: '重建刷新点区域',
        fn: 'RebuildSpawnZones',
        requiresMysql: true,
        sub: 'data/area_grid.bin + 世界数据库坐标',
        desc: '使用客户端区域网格（实际地形）而非相互重叠的区域框，将每个生物和游戏物体的刷新点重新解析到正确的区域。修复边界标注错误 — 例如西部荒野的怪物被算作艾尔文森林，或艾尔文森林的怪物被划入暮色森林。不进行 octowow 抓取；会报告各区域的净变化。请在客户端数据导入之后运行，以确保区域网格存在。',
    },
]

// DatasetInventory lists every client-derived dataset and whether it's present,
// so the user can see exactly what's missing — and which client file feeds it.
// Missing datasets (count 0) sort first and name their source DBC / art folder.
function DatasetInventory({ datasets }) {
    const sorted = [...datasets].sort(
        (a, b) => (a.count > 0) - (b.count > 0) || a.label.localeCompare(b.label),
    )
    const missing = datasets.filter((d) => d.count === 0).length
    return (
        <div className="mt-3 border-t border-gray-700/50 pt-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-gray-500">
                    数据清单
                </span>
                <span
                    className={`font-mono text-[11px] ${missing > 0 ? 'text-red-400' : 'text-green-400'}`}
                >
                    {missing > 0 ? `缺少 ${missing} 项` : '全部就绪'}
                </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {sorted.map((d) => {
                    const ok = d.count > 0
                    return (
                        <div
                            key={d.key}
                            className={`flex items-center gap-2 rounded border px-2 py-1 ${
                                ok
                                    ? 'border-gray-700/40 bg-black/20'
                                    : 'border-red-500/40 bg-red-500/10'
                            }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`truncate text-xs ${ok ? 'text-gray-200' : 'font-semibold text-red-300'}`}
                                    >
                                        {d.label}
                                    </span>
                                    <span
                                        className={`shrink-0 font-mono text-[11px] ${ok ? 'text-gray-400' : 'text-red-400'}`}
                                    >
                                        {ok ? d.count.toLocaleString() : '缺失'}
                                    </span>
                                </div>
                                <div
                                    className="truncate font-mono text-[10px] text-gray-600"
                                    title={d.source}
                                >
                                    {d.source}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function ToolsPage() {
    const entityNavigate = useEntityNavigate()
    const queryClient = useQueryClient()
    const [base, setBase] = useState(() => localStorage.getItem('toolsBasePath') || DEFAULT_BASE)
    const [running, setRunning] = useState(null)
    const [reports, setReports] = useState({})
    const { data: status } = useDataStatus()

    // Render diagnostics: where the app reads/writes, and whether the client
    // archives open — refreshed when the base path changes (debounced).
    const [diag, setDiag] = useState(null)
    useEffect(() => {
        const t = setTimeout(() => {
            window?.go?.main?.App?.GetRenderDiagnostics?.(base)?.then(setDiag)
        }, 400)
        return () => clearTimeout(t)
    }, [base])

    const { data: whatsNew, isFetching: wnLoading } = useWhatsNew()
    // staleTime: 0 forces a fresh diff on every Check; the cached result still
    // persists across navigation via the hook's Infinity staleTime.
    const loadWhatsNew = () => queryClient.fetchQuery({ ...whatsNewQuery, staleTime: 0 })

    const saveBase = (v) => {
        setBase(v)
        localStorage.setItem('toolsBasePath', v)
    }

    // Native folder picker (Wails). Returns "" on cancel — keep the current value.
    const browseBase = () =>
        window?.go?.main?.App?.SelectClientFolder?.(base)?.then(
            (picked) => picked && saveBase(picked),
        )

    const run = async (imp) => {
        const app = window?.go?.main?.App
        if (!app || !app[imp.fn]) {
            setReports((r) => ({
                ...r,
                [imp.id]: {
                    success: false,
                    title: '不可用',
                    lines: ['未找到绑定（开发版本？）'],
                },
            }))
            return
        }
        setRunning(imp.id)
        try {
            const rep = await app[imp.fn](base)
            setReports((r) => ({ ...r, [imp.id]: rep }))
        } catch (e) {
            setReports((r) => ({
                ...r,
                [imp.id]: { success: false, title: '失败', lines: [String(e)] },
            }))
        } finally {
            setRunning(null)
            // An import rewrites reference data, icons and maps; drop every cached
            // query so views refetch the fresh data (overrides staleTime: Infinity).
            // This includes dataStatus, refreshing the inventory below.
            queryClient.invalidateQueries()
        }
    }

    // World-DB importers only exist for users running against MySQL. Hidden until
    // status confirms a connection, so the card never appears and then vanishes.
    const imports = IMPORTS.filter((imp) => !imp.requiresMysql || status?.mysql)

    // Categories that are populated by an import and worth warning about when empty.
    const missing = status
        ? [status.icons === 0 && '图标', status.maps === 0 && '区域地图'].filter(Boolean)
        : []

    return (
        <PageLayout>
            <div className="mx-auto h-full max-w-3xl space-y-6 overflow-y-auto p-6">
                <div>
                    <h2 className="mb-1 text-xl font-bold text-wow-gold">导入</h2>
                    <p className="text-sm text-gray-400">
                        从本地 WoW 客户端刷新 InkLab 的数据。不会上传任何内容 — 每次导入仅读取下方文件夹中的文件。
                    </p>
                </div>

                {missing.length > 0 && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                        <div className="text-sm font-semibold text-amber-300">
                            ⚠️ 未找到{missing.join('或')}
                        </div>
                        <p className="mt-1 text-sm text-amber-200/80">
                            InkLab 不附带{missing.join(' / ')} — 它们需要从你本地的 WoW 客户端构建。请在下方设置客户端文件夹并运行相应的导入，否则物品将显示占位图标，NPC 也不会显示区域地图。
                        </p>
                    </div>
                )}

                <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
                    <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">
                        WoW 客户端文件夹
                    </label>
                    <div className="flex gap-2">
                        <input
                            value={base}
                            onChange={(e) => saveBase(e.target.value)}
                            spellCheck={false}
                            className="w-full rounded border border-border-light bg-bg-dark px-3 py-2 font-mono text-sm text-gray-200 focus:border-wow-gold/50 focus:outline-none"
                            placeholder={DEFAULT_BASE}
                        />
                        <button
                            type="button"
                            onClick={browseBase}
                            className="shrink-0 rounded border border-border-light bg-bg-dark px-3 py-2 text-sm text-gray-200 hover:border-wow-gold/50 hover:text-wow-gold focus:border-wow-gold/50 focus:outline-none"
                        >
                            浏览…
                        </button>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-600">
                        存在 <span className="font-mono">Data\*.MPQ</span> 时直接读取
                        （不会写回任何内容），缓存导入还会读取 <span className="font-mono">WDB\</span>；
                        否则回退到松散的{' '}
                        <span className="font-mono">DBFilesClient\</span> /{' '}
                        <span className="font-mono">BlizzardInterfaceArt\</span> 文件夹。
                    </p>

                    {/* Where things live: the app's resolved paths + whether the
                        client archives open. Answers "why don't models render"
                        and "where did my renders go" without guesswork. */}
                    {diag && (
                        <div className="mt-3 space-y-1 border-t border-gray-700/50 pt-3 text-[11px]">
                            <div className="flex justify-between gap-3">
                                <span className="shrink-0 text-gray-500">应用数据文件夹</span>
                                <span
                                    className="truncate font-mono text-gray-300"
                                    title={diag.dataDir}
                                >
                                    {diag.dataDir}
                                </span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="shrink-0 text-gray-500">模型渲染缓存</span>
                                <span
                                    className="truncate font-mono text-gray-300"
                                    title="查看 NPC 时按需生成渲染图，超过约 7 天未查看会被清理 — 数量波动属正常现象。"
                                >
                                    {diag.npcImages} 个文件
                                </span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="shrink-0 text-gray-500">客户端归档</span>
                                {diag.mpqOk ? (
                                    <span className="font-mono text-green-400">
                                        正常 — {diag.clientData}
                                    </span>
                                ) : (
                                    <span
                                        className="truncate font-mono text-red-400"
                                        title={diag.mpqError || '无法打开 MPQ 归档'}
                                    >
                                        失败 — {diag.mpqError || `无法打开 ${diag.clientData}`}
                                    </span>
                                )}
                            </div>
                            {!diag.mpqOk && (
                                <p className="pt-1 text-amber-300/80">
                                    模型渲染需要这些归档 — 在其可正常打开之前，NPC 模型将无法渲染。请检查上方的客户端文件夹路径。
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {imports.map((imp) => {
                    const rep = reports[imp.id]
                    const busy = running === imp.id
                    return (
                        <div
                            key={imp.id}
                            className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-white">{imp.name}</h3>
                                    <p className="mt-1 text-sm text-gray-400">{imp.desc}</p>
                                    <p className="mt-1 font-mono text-[11px] text-gray-600">
                                        {imp.sub}
                                    </p>
                                </div>
                                <button
                                    onClick={() => run(imp)}
                                    disabled={!!running}
                                    className="shrink-0 rounded bg-wow-gold/90 px-5 py-2 font-bold text-black transition-colors hover:bg-wow-gold disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {busy ? '运行中…' : '运行'}
                                </button>
                            </div>
                            {imp.id === 'client' && status?.datasets?.length > 0 && (
                                <DatasetInventory datasets={status.datasets} />
                            )}
                            {rep && (
                                <div
                                    className={`mt-3 rounded border p-3 ${
                                        rep.success
                                            ? 'border-green-500/30 bg-green-500/5'
                                            : 'border-red-500/30 bg-red-500/5'
                                    }`}
                                >
                                    <div
                                        className={`text-sm font-bold ${rep.success ? 'text-green-400' : 'text-red-400'}`}
                                    >
                                        {rep.title}
                                    </div>
                                    {rep.lines?.map((l, i) => (
                                        <div
                                            key={i}
                                            className="mt-0.5 break-all font-mono text-xs text-gray-300"
                                        >
                                            {l}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* What's New — diff of the live DB vs the baseline. Placed last: it's
            noise for a brand-new user who hasn't imported anything yet. */}
                <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h3 className="font-semibold text-white">更新内容</h3>
                            <p className="mt-1 text-sm text-gray-400">
                                自上次提交的基线以来，数据库中新增或变更的记录 — 例如你的导入带入的物品、NPC 和物体。点击条目即可打开。
                            </p>
                            {whatsNew?.baseline && (
                                <p className="mt-1 text-[11px] text-gray-600">
                                    对比 {whatsNew.baseline}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => loadWhatsNew()}
                            disabled={wnLoading}
                            className="shrink-0 rounded bg-wow-gold/90 px-5 py-2 font-bold text-black transition-colors hover:bg-wow-gold disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {wnLoading ? '检查中…' : '检查'}
                        </button>
                    </div>

                    {whatsNew?.error && (
                        <div className="mt-3 rounded border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
                            {whatsNew.error}
                        </div>
                    )}

                    {whatsNew && !whatsNew.error && (
                        <div className="mt-3 space-y-3">
                            {!whatsNew.groups?.length && (
                                <div className="text-sm italic text-gray-500">
                                    自基线以来没有变化。
                                </div>
                            )}
                            {whatsNew.groups?.map((g) => (
                                <div
                                    key={g.type}
                                    className="rounded border border-gray-700/50 bg-black/20 p-3"
                                >
                                    <div className="mb-2 text-sm font-bold text-gray-200">
                                        {g.label}{' '}
                                        <span className="font-normal text-green-400">
                                            +{g.added} 新增
                                        </span>
                                        {g.changed > 0 && (
                                            <span className="font-normal text-blue-400">
                                                {' '}
                                                • {g.changed} 变更
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {g.entries?.map((e) => (
                                            <button
                                                key={`${e.type}-${e.id}`}
                                                onClick={() => entityNavigate(e.type, e.id)}
                                                title={`${e.change === 'added' ? '新增' : '变更'} — 打开 ${e.type} ${e.id}`}
                                                className={`rounded border px-2 py-1 text-left text-xs transition-colors ${
                                                    e.change === 'added'
                                                        ? 'border-green-600/40 bg-green-600/10 text-green-200 hover:bg-green-600/20'
                                                        : 'border-blue-600/40 bg-blue-600/10 text-blue-200 hover:bg-blue-600/20'
                                                }`}
                                            >
                                                <span className="font-mono text-gray-500">
                                                    [{e.id}]
                                                </span>{' '}
                                                {e.name || '（未命名）'}
                                            </button>
                                        ))}
                                        {g.added + g.changed > g.entries.length && (
                                            <span className="self-center text-xs text-gray-600">
                                                … 另有 {g.added + g.changed - g.entries.length} 项
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageLayout>
    )
}

export default ToolsPage
