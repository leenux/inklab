import { useEffect, useState } from 'react'
import { PageLayout } from '../../components/ui'
import {
    RAID_TIMERS,
    MISC_TIMERS,
    nextOccurrence,
    battlegroundState,
    edgeOfMadnessState,
    dmfSchedule,
    formatCountdown,
    formatLocal,
} from '../../utils/turtleTimers'

function useNow() {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])
    return now
}

function TimerCard({ title, subtitle, value, valueClass = '', countdownMs, footer, note }) {
    return (
        <div className="flex flex-col gap-1 rounded border border-border-dark bg-bg-panel p-4">
            <div className="text-sm font-bold uppercase text-wow-gold">{title}</div>
            {subtitle && <div className="text-xs text-white/50">{subtitle}</div>}
            {value && <div className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</div>}
            <div className="mt-1 text-3xl font-bold tabular-nums text-white">
                {formatCountdown(countdownMs)}
            </div>
            {footer && <div className="mt-1 text-xs text-white/60">{footer}</div>}
            {note && <div className="mt-2 text-xs italic text-white/40">{note}</div>}
        </div>
    )
}

function SectionTitle({ children }) {
    return (
        <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-white/60 first:mt-0">
            {children}
        </h2>
    )
}

export default function TimersPage() {
    const now = useNow()

    const bg = battlegroundState(now)
    const eom = edgeOfMadnessState(now)
    const dmf = dmfSchedule(now)

    const dmfFactionClass =
        dmf.current.faction === 'Horde' ? 'text-wow-horde' : 'text-wow-alliance'

    return (
        <PageLayout>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-5xl">
                    <p className="mb-4 text-xs text-white/40">
                        Octo WoW 重置时间表（本地计算）— 团队副本在 UTC 04:00 重置，
                        暗月马戏团在 UTC 午夜迁移，以下所有时间均显示为你的本地时区。
                    </p>

                    <SectionTitle>团队副本重置</SectionTitle>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {RAID_TIMERS.map((t) => {
                            const resetMs = nextOccurrence(t, now)
                            return (
                                <TimerCard
                                    key={t.id}
                                    title={t.name}
                                    subtitle={`${t.detail ? `${t.detail} — ` : ''}每 ${t.periodDays} 天`}
                                    countdownMs={resetMs - now}
                                    footer={`重置于 ${formatLocal(resetMs)}`}
                                />
                            )
                        })}
                    </div>

                    <SectionTitle>世界事件</SectionTitle>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <TimerCard
                            title="暗月马戏团"
                            subtitle="每周三迁移 · 迁移期间关闭"
                            value={
                                dmf.current.setupDay
                                    ? `搭建日 — 将在${dmf.current.location}重新开放`
                                    : `${dmf.current.location} (${dmf.current.town})`
                            }
                            valueClass={dmfFactionClass}
                            // On the setup Wednesday the countdown is to tomorrow's
                            // reopening; otherwise to the next relocation.
                            countdownMs={
                                (dmf.current.setupDay ? dmf.reopensMs : dmf.moveMs) - now
                            }
                            footer={
                                dmf.current.setupDay
                                    ? `重新开放于 ${formatLocal(dmf.reopensMs)}`
                                    : `迁往${dmf.moveState.location} ${formatLocal(dmf.moveMs)}`
                            }
                        />
                        <TimerCard
                            title="每日战场"
                            subtitle="每日轮换"
                            value={bg.current}
                            countdownMs={bg.nextChangeMs - now}
                            footer={`下一个：${bg.next}，${formatLocal(bg.nextChangeMs)}`}
                        />
                        <TimerCard
                            title="疯狂之缘"
                            subtitle="祖尔格拉布 — 每 14 天轮换"
                            value={eom.current}
                            countdownMs={eom.nextChangeMs - now}
                            footer={`下一个：${eom.next}，${formatLocal(eom.nextChangeMs)}`}
                        />
                        {MISC_TIMERS.map((t) => {
                            const resetMs = nextOccurrence(t, now)
                            return (
                                <TimerCard
                                    key={t.id}
                                    title={t.name}
                                    subtitle={`每 ${t.periodDays} 天`}
                                    countdownMs={resetMs - now}
                                    footer={`重置于 ${formatLocal(resetMs)}`}
                                    note={t.note}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>
        </PageLayout>
    )
}
