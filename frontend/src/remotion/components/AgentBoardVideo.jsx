import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  Code2,
  DollarSign,
  FolderKanban,
  GitBranch,
  Kanban,
  Layers,
  MessageSquare,
  Radio,
  Search,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { createElement } from 'react'

const palette = {
  bg: '#0f172a',
  panel: '#1e293b',
  panel2: '#111827',
  card: '#1f2937',
  hover: '#334155',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  cyan: '#06b6d4',
  violet: '#8b5cf6',
  rose: '#ec4899',
}

const navItems = [
  { label: 'Dashboard', icon: Activity, active: true },
  { label: 'Board', icon: Kanban },
  { label: 'Agents', icon: Users },
  { label: 'Leaderboard', icon: Trophy },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Sprints', icon: Zap },
  { label: 'Standups', icon: MessageSquare },
  { label: 'Activity', icon: Radio },
]

const agentRows = [
  { name: 'Claude Builder', model: 'sonnet-4.5', status: 'active', tokens: '1.28M', cost: '$13.44', color: palette.accent },
  { name: 'Frontend Fixer', model: 'gpt-5.4', status: 'active', tokens: '820K', cost: '$8.02', color: palette.success },
  { name: 'QA Verifier', model: 'codex', status: 'idle', tokens: '314K', cost: '$2.91', color: palette.warning },
  { name: 'API Worker', model: 'sonnet-4.5', status: 'blocked', tokens: '557K', cost: '$4.20', color: palette.danger },
]

const ticketColumns = [
  {
    title: 'Todo',
    color: palette.muted,
    cards: ['Add webhook delivery logs', 'Audit sprint metrics', 'Clean stale agent keys'],
  },
  {
    title: 'In Progress',
    color: palette.accent,
    cards: ['Build trace viewer', 'Wire session broadcasts', 'Render product demo'],
  },
  {
    title: 'Review',
    color: palette.warning,
    cards: ['Leaderboard scoring rules', 'Ticket changes endpoint'],
  },
  {
    title: 'Done',
    color: palette.success,
    cards: ['Persistent login', 'Token cost overview', 'Agent sparklines'],
  },
]

const traceEvents = [
  { icon: Bot, label: 'Session started', meta: 'Claude Builder connected', color: palette.accent },
  { icon: Search, label: 'Read project context', meta: '12 files inspected', color: palette.cyan },
  { icon: Code2, label: 'Edited tracking.py', meta: '+86 lines, -12 lines', color: palette.warning },
  { icon: GitBranch, label: 'Broadcast emitted', meta: 'session.ended pushed live', color: palette.violet },
  { icon: CheckCircle2, label: 'Verification passed', meta: 'server import and UI build clean', color: palette.success },
]

function fade(frame, start, end, from = 0, to = 1) {
  return interpolate(frame, [start, end], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

function usePop(frame, delay = 0) {
  const { fps } = useVideoConfig()
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 120 },
  })
}

function SlideIn({ children, delay = 0, y = 28, style }) {
  const frame = useCurrentFrame()
  const progress = usePop(frame, delay)
  return (
    <div
      style={{
        opacity: fade(frame, delay, delay + 12),
        transform: `translateY(${interpolate(progress, [0, 1], [y, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Shell({ children, active = 'Dashboard' }) {
  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif' }}>
      <div style={{ display: 'flex', height: '100%' }}>
        <aside style={{ width: 260, background: palette.panel, borderRight: `1px solid ${palette.border}` }}>
          <div style={{ height: 72, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: `1px solid ${palette.border}` }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: palette.accent, display: 'grid', placeItems: 'center', marginRight: 12 }}>
              <Bot size={20} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Agent Board</div>
          </div>
          <nav style={{ padding: 14 }}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = item.label === active
              return (
                <div
                  key={item.label}
                  style={{
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0 14px',
                    marginBottom: 6,
                    borderRadius: 8,
                    fontSize: 15,
                    color: isActive ? '#fff' : palette.muted,
                    background: isActive ? palette.accent : 'transparent',
                  }}
                >
                  <Icon size={18} />
                  {item.label}
                </div>
              )
            })}
          </nav>
        </aside>
        <main style={{ flex: 1, minWidth: 0 }}>
          <header style={{ height: 72, background: palette.panel, borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px' }}>
            <div style={{ height: 38, minWidth: 170, border: `1px solid ${palette.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 14px', color: palette.text, background: palette.bg }}>
              All Projects
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: palette.success, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: palette.success }} />
                Live sync
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: palette.accent, display: 'grid', placeItems: 'center', fontWeight: 800 }}>VB</div>
            </div>
          </header>
          <div style={{ padding: 34 }}>{children}</div>
        </main>
      </div>
    </AbsoluteFill>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

function MetricCard({ icon, label, value, color, delay }) {
  return (
    <SlideIn delay={delay}>
      <Card style={{ height: 124, padding: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: `${color}22`, color, display: 'grid', placeItems: 'center' }}>
          {createElement(icon, { size: 25 })}
        </div>
        <div>
          <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 800 }}>{value}</div>
          <div style={{ fontSize: 15, color: palette.muted, marginTop: 8 }}>{label}</div>
        </div>
      </Card>
    </SlideIn>
  )
}

function BarChartBlock() {
  const frame = useCurrentFrame()
  const bars = [
    { label: 'Todo', value: 58, color: palette.muted },
    { label: 'Progress', value: 78, color: palette.accent },
    { label: 'Review', value: 38, color: palette.warning },
    { label: 'Done', value: 92, color: palette.success },
    { label: 'Blocked', value: 22, color: palette.danger },
  ]
  return (
    <Card style={{ height: 270, padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>Tickets by Status</div>
      <div style={{ height: 174, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
        {bars.map((bar, index) => {
          const height = interpolate(fade(frame, 18 + index * 4, 52 + index * 4), [0, 1], [8, bar.value])
          return (
            <div key={bar.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: '100%', height: `${height}%`, borderRadius: '8px 8px 3px 3px', background: bar.color }} />
              <div style={{ color: palette.muted, fontSize: 13 }}>{bar.label}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function DashboardScene() {
  return (
    <Shell active="Dashboard">
      <SlideIn>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>System Overview</h1>
          <div style={{ color: palette.muted, fontSize: 15 }}>Auto-refreshes every 30s</div>
        </div>
      </SlideIn>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 18 }}>
        <MetricCard icon={Users} label="Active Agents" value="8" color={palette.success} delay={4} />
        <MetricCard icon={Circle} label="Idle Agents" value="3" color={palette.muted} delay={8} />
        <MetricCard icon={AlertTriangle} label="Blocked Agents" value="1" color={palette.warning} delay={12} />
        <MetricCard icon={DollarSign} label="Cost Today" value="$18.42" color={palette.success} delay={16} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 18 }}>
        <MetricCard icon={Zap} label="Tokens Today" value="2.1M" color={palette.violet} delay={20} />
        <MetricCard icon={Layers} label="Active Sessions" value="6" color={palette.accent} delay={24} />
        <MetricCard icon={CheckCircle2} label="Tickets Done" value="42" color={palette.success} delay={28} />
        <MetricCard icon={Radio} label="Live Events" value="127" color={palette.cyan} delay={32} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18 }}>
        <SlideIn delay={34}><BarChartBlock /></SlideIn>
        <SlideIn delay={42}>
          <Card style={{ height: 270, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>Recent Activity</div>
            {['session.started', 'ticket.updated', 'agent.updated', 'session.ended'].map((event, index) => (
              <div key={event} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: index ? `1px solid ${palette.border}` : 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, display: 'grid', placeItems: 'center', background: `${palette.accent}22`, color: palette.accent }}>
                  <Activity size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15 }}>{event}</div>
                  <div style={{ color: palette.muted, fontSize: 13 }}>{index + 1} min ago</div>
                </div>
              </div>
            ))}
          </Card>
        </SlideIn>
      </div>
    </Shell>
  )
}

function BoardScene() {
  const frame = useCurrentFrame()
  return (
    <Shell active="Board">
      <SlideIn>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Sprint Board</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {['All', 'P0', 'P1', 'P2'].map((filter, index) => (
              <div key={filter} style={{ padding: '9px 16px', borderRadius: 8, background: index === 0 ? palette.accent : palette.panel, border: `1px solid ${palette.border}`, fontSize: 14 }}>{filter}</div>
            ))}
          </div>
        </div>
      </SlideIn>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        {ticketColumns.map((column, columnIndex) => (
          <SlideIn key={column.title} delay={columnIndex * 6 + 8}>
            <Card style={{ minHeight: 740, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: column.color }} />
                  <span style={{ fontWeight: 800, fontSize: 18 }}>{column.title}</span>
                </div>
                <span style={{ color: palette.muted }}>{column.cards.length}</span>
              </div>
              {column.cards.map((card, cardIndex) => {
                const activeMove = columnIndex === 1 && cardIndex === 2
                const x = activeMove ? interpolate(frame, [75, 118], [0, 38], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
                const y = activeMove ? interpolate(frame, [75, 118], [0, -28], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
                return (
                  <div
                    key={card}
                    style={{
                      padding: 18,
                      borderRadius: 10,
                      background: activeMove ? '#243b64' : palette.bg,
                      border: `1px solid ${activeMove ? palette.accent : palette.border}`,
                      marginBottom: 14,
                      transform: `translate(${x}px, ${y}px)`,
                      boxShadow: activeMove ? '0 18px 44px rgba(59, 130, 246, 0.28)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{card}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <span style={{ color: column.color, fontSize: 12, border: `1px solid ${column.color}66`, borderRadius: 999, padding: '4px 9px' }}>P{Math.min(columnIndex + 1, 3)}</span>
                      <span style={{ color: palette.muted, fontSize: 12, border: `1px solid ${palette.border}`, borderRadius: 999, padding: '4px 9px' }}>agent</span>
                    </div>
                  </div>
                )
              })}
            </Card>
          </SlideIn>
        ))}
      </div>
    </Shell>
  )
}

function AgentsScene() {
  return (
    <Shell active="Agents">
      <SlideIn>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Agent Monitoring</h1>
          <div style={{ background: palette.accent, padding: '10px 16px', borderRadius: 8, fontWeight: 700 }}>Register Agent</div>
        </div>
      </SlideIn>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 18 }}>
        <MetricCard icon={Bot} label="Total Agents" value="12" color={palette.accent} delay={4} />
        <MetricCard icon={Radio} label="Online Now" value="8" color={palette.success} delay={8} />
        <MetricCard icon={Zap} label="Avg Tokens" value="183K" color={palette.violet} delay={12} />
        <MetricCard icon={Trophy} label="Top Score" value="98" color={palette.warning} delay={16} />
      </div>
      <Card style={{ padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.8fr 0.8fr 1fr', color: palette.muted, fontSize: 14, padding: '0 10px 12px' }}>
          <div>Agent</div><div>Model</div><div>Status</div><div>Tokens</div><div>Cost</div>
        </div>
        {agentRows.map((agent, index) => (
          <SlideIn key={agent.name} delay={24 + index * 6}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.8fr 0.8fr 1fr', alignItems: 'center', minHeight: 86, background: index % 2 ? palette.panel2 : palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, marginBottom: 12, padding: '0 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, background: `${agent.color}22`, color: agent.color, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{agent.name.slice(0, 2)}</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{agent.name}</div>
                  <div style={{ color: palette.muted, fontSize: 13 }}>heartbeat just now</div>
                </div>
              </div>
              <div style={{ color: palette.muted }}>{agent.model}</div>
              <div style={{ color: agent.status === 'blocked' ? palette.danger : agent.status === 'idle' ? palette.muted : palette.success, fontWeight: 700 }}>{agent.status}</div>
              <div>{agent.tokens}</div>
              <div>{agent.cost}</div>
            </div>
          </SlideIn>
        ))}
      </Card>
    </Shell>
  )
}

function TraceScene() {
  return (
    <Shell active="Activity">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <SlideIn>
          <Card style={{ padding: 24, height: 850 }}>
            <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Ticket Detail</h1>
            <div style={{ color: palette.muted, fontSize: 15, marginBottom: 24 }}>Trace and code-change visibility for every agent session</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {['Overview', 'Performance', 'Changes', 'Trace'].map((tab, index) => (
                <div key={tab} style={{ borderRadius: 8, padding: '10px 14px', fontSize: 14, background: index > 1 ? palette.accent : palette.bg, border: `1px solid ${palette.border}` }}>{tab}</div>
              ))}
            </div>
            {traceEvents.map((event, index) => {
              const Icon = event.icon
              return (
                <SlideIn key={event.label} delay={16 + index * 9}>
                  <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14, minHeight: 102 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 999, background: `${event.color}22`, color: event.color, display: 'grid', placeItems: 'center' }}>
                        <Icon size={19} />
                      </div>
                      {index < traceEvents.length - 1 && <div style={{ flex: 1, width: 2, background: palette.border }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{event.label}</div>
                      <div style={{ color: palette.muted, fontSize: 14, marginTop: 5 }}>{event.meta}</div>
                    </div>
                  </div>
                </SlideIn>
              )
            })}
          </Card>
        </SlideIn>
        <SlideIn delay={10}>
          <Card style={{ padding: 24, height: 850 }}>
            <h2 style={{ fontSize: 24, margin: '0 0 18px' }}>Code Changes</h2>
            {[
              ['backend/app/routes/tracking.py', '+142', '-18', palette.success],
              ['frontend/src/hooks/useSocket.js', '+96', '-0', palette.accent],
              ['frontend/src/pages/BoardPage.jsx', '+44', '-7', palette.warning],
              ['backend/app/realtime.py', '+67', '-0', palette.violet],
            ].map((row, index) => (
              <SlideIn key={row[0]} delay={26 + index * 8}>
                <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{row[0]}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: palette.success, border: `1px solid ${palette.success}55`, borderRadius: 999, padding: '4px 9px' }}>{row[1]}</span>
                      <span style={{ color: palette.danger, border: `1px solid ${palette.danger}55`, borderRadius: 999, padding: '4px 9px' }}>{row[2]}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: palette.panel }}>
                    <div style={{ width: `${72 - index * 11}%`, height: '100%', borderRadius: 999, background: row[3] }} />
                  </div>
                </div>
              </SlideIn>
            ))}
          </Card>
        </SlideIn>
      </div>
    </Shell>
  )
}

function FinaleScene({ productName }) {
  const frame = useCurrentFrame()
  const scale = interpolate(usePop(frame, 8), [0, 1], [0.94, 1])
  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 1180, textAlign: 'center', transform: `scale(${scale})` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: palette.success, fontSize: 20, marginBottom: 24 }}>
          <Radio size={22} />
          Production-grade agent monitoring
        </div>
        <h1 style={{ fontSize: 96, lineHeight: 1, margin: 0, fontWeight: 900 }}>{productName}</h1>
        <p style={{ color: palette.muted, fontSize: 30, lineHeight: 1.45, margin: '28px auto 0', width: 920 }}>
          Track sessions, tickets, costs, code changes, and real-time agent activity from one operational dashboard.
        </p>
      </div>
    </AbsoluteFill>
  )
}

function Transition() {
  const frame = useCurrentFrame()
  const x = interpolate(frame, [0, 20, 40], [1920, 0, -1920], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ width: 1920, height: 1080, background: palette.accent, transform: `translateX(${x}px)` }} />
    </AbsoluteFill>
  )
}

export function AgentBoardVideo({ productName }) {
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <Sequence from={0} durationInFrames={270}>
        <DashboardScene />
      </Sequence>
      <Sequence from={250} durationInFrames={40}>
        <Transition />
      </Sequence>
      <Sequence from={270} durationInFrames={270}>
        <BoardScene />
      </Sequence>
      <Sequence from={520} durationInFrames={40}>
        <Transition />
      </Sequence>
      <Sequence from={540} durationInFrames={270}>
        <AgentsScene />
      </Sequence>
      <Sequence from={790} durationInFrames={40}>
        <Transition />
      </Sequence>
      <Sequence from={810} durationInFrames={270}>
        <TraceScene />
      </Sequence>
      <Sequence from={1060} durationInFrames={40}>
        <Transition />
      </Sequence>
      <Sequence from={1080} durationInFrames={180}>
        <FinaleScene productName={productName} />
      </Sequence>
    </AbsoluteFill>
  )
}
