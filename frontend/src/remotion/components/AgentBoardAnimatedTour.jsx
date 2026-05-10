import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
/* eslint-disable react-refresh/only-export-components */
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  Code2,
  Cog,
  DollarSign,
  FolderKanban,
  GitBranch,
  Kanban,
  Lock,
  MessageSquare,
  Radio,
  Search,
  Shield,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { createElement } from 'react'

const palette = {
  bg: '#070b16',
  main: '#0a0f1c',
  sidebar: '#0f172a',
  panel: '#111827',
  card: '#1e293b',
  card2: '#162033',
  border: '#263449',
  text: '#f8fafc',
  muted: '#94a3b8',
  blue: '#3b82f6',
  cyan: '#22d3ee',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  rose: '#ec4899',
}

const navItems = [
  ['Dashboard', Activity],
  ['Board', Kanban],
  ['Agents', Bot],
  ['Leaderboard', Trophy],
  ['Teams', Users],
  ['Projects', FolderKanban],
  ['Sprints', Zap],
  ['Standups', MessageSquare],
  ['Activity', Radio],
  ['Settings', Cog],
]

const scenes = [
  { key: 'dashboard', nav: 'Dashboard', title: 'Dashboard', group: 'Overview', icon: Activity, color: palette.blue, type: 'dashboard', line: 'See the whole agent operation in one live command center.' },
  { key: 'board', nav: 'Board', title: 'Board / Kanban', group: 'Workflow', icon: Kanban, color: palette.cyan, type: 'board', line: 'Move agent work across todo, in progress, review, and done.' },
  { key: 'ticket', nav: 'Board', title: 'Board / Ticket Detail', group: 'Workflow', icon: CheckCircle2, color: palette.green, type: 'ticket', line: 'Open a ticket and inspect the actual work behind the status.' },
  { key: 'agents', nav: 'Agents', title: 'Agents / Fleet', group: 'Agents', icon: Bot, color: palette.violet, type: 'agents', line: 'Monitor every agent, model, status, heartbeat, tokens, and cost.' },
  { key: 'profile', nav: 'Agents', title: 'Agents / Profile', group: 'Agents', icon: Users, color: palette.violet, type: 'profile', line: 'Drill into one teammate and understand recent performance.' },
  { key: 'leaderboard', nav: 'Leaderboard', title: 'Leaderboard', group: 'Performance', icon: Trophy, color: palette.yellow, type: 'leaderboard', line: 'Compare the agent team by reliability, speed, and delivery quality.' },
  { key: 'teams', nav: 'Teams', title: 'Teams', group: 'Organization', icon: Users, color: palette.green, type: 'teams', line: 'Group people and agents so ownership stays clear.' },
  { key: 'projects', nav: 'Projects', title: 'Projects', group: 'Organization', icon: FolderKanban, color: palette.blue, type: 'projects', line: 'Keep each project connected to its tickets, team, and agent context.' },
  { key: 'sprints-list', nav: 'Sprints', title: 'Sprints / List', group: 'Planning', icon: Zap, color: palette.rose, type: 'sprints', line: 'Plan focused cycles and see delivery health before it slips.' },
  { key: 'sprint-detail', nav: 'Sprints', title: 'Sprints / Detail', group: 'Planning', icon: Zap, color: palette.rose, type: 'sprintDetail', line: 'Open a sprint to track goals, progress, load, and completion.' },
  { key: 'standups', nav: 'Standups', title: 'Standups', group: 'Rhythm', icon: MessageSquare, color: palette.cyan, type: 'standups', line: 'Bring human and agent updates into one daily rhythm.' },
  { key: 'activity', nav: 'Activity', title: 'Activity', group: 'Realtime', icon: Radio, color: palette.green, type: 'activity', line: 'Audit live events, session changes, and ticket movement.' },
  { key: 'settings-agent-types', nav: 'Settings', title: 'Settings / Agent Types', group: 'Settings', icon: Cog, color: palette.yellow, type: 'settingsAgents', line: 'Define the roles and behaviors agents should start with.' },
  { key: 'settings-teams', nav: 'Settings', title: 'Settings / Teams', group: 'Settings', icon: Cog, color: palette.yellow, type: 'settingsTeams', line: 'Configure the team layer once and reuse it everywhere.' },
  { key: 'settings-projects', nav: 'Settings', title: 'Settings / Projects', group: 'Settings', icon: Cog, color: palette.yellow, type: 'settingsProjects', line: 'Control project setup as the operation grows.' },
  { key: 'settings-users', nav: 'Settings', title: 'Settings / Users', group: 'Settings', icon: Cog, color: palette.yellow, type: 'settingsUsers', line: 'Manage users, permissions, and review access.' },
  { key: 'settings-github', nav: 'Settings', title: 'Settings / GitHub', group: 'Settings', icon: Cog, color: palette.yellow, type: 'settingsGithub', line: 'Connect code activity back to tickets and agent sessions.' },
  { key: 'login', nav: 'Settings', title: 'Login', group: 'Access', icon: Lock, color: palette.blue, type: 'login', line: 'Persistent access keeps the team in the same workspace.' },
]

const fps = 30
const introFrames = 120
const sceneFrames = 195
const outroFrames = 150
export const animatedTourDuration = introFrames + scenes.length * sceneFrames + outroFrames

function clampInterpolate(frame, input, output, easing = Easing.out(Easing.cubic)) {
  return interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  })
}

function useSpring(delay = 0) {
  const frame = useCurrentFrame()
  const config = useVideoConfig()
  return spring({
    frame: frame - delay,
    fps: config.fps,
    config: { damping: 18, stiffness: 110 },
  })
}

function Reveal({ children, delay = 0, y = 20, style }) {
  const frame = useCurrentFrame()
  const progress = useSpring(delay)
  return (
    <div
      style={{
        opacity: clampInterpolate(frame, [delay, delay + 14], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [y, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function IconBubble({ icon, color, size = 44 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, display: 'grid', placeItems: 'center', color, background: `${color}22`, border: `1px solid ${color}55` }}>
      {createElement(icon, { size: Math.round(size * 0.48) })}
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ borderRadius: 12, background: palette.card, border: `1px solid ${palette.border}`, boxShadow: '0 18px 45px rgba(0,0,0,0.18)', ...style }}>
      {children}
    </div>
  )
}

function Progress({ value, color, delay = 0 }) {
  const frame = useCurrentFrame()
  const width = clampInterpolate(frame, [delay, delay + 46], [4, value])
  return (
    <div style={{ height: 10, borderRadius: 999, background: palette.panel, overflow: 'hidden' }}>
      <div style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: color }} />
    </div>
  )
}

function Cursor({ color = palette.cyan }) {
  const frame = useCurrentFrame()
  const x = clampInterpolate(frame, [20, 95, 170, 220], [1180, 1380, 1040, 1290])
  const y = clampInterpolate(frame, [20, 95, 170, 220], [650, 220, 460, 710])
  const click = clampInterpolate(frame, [94, 101, 110], [0, 1, 0], Easing.out(Easing.quad))
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 20, transform: 'translate(-4px, -4px)' }}>
      <div style={{ position: 'absolute', left: -18, top: -18, width: 42 + click * 30, height: 42 + click * 30, borderRadius: 999, border: `2px solid ${color}`, opacity: click * 0.8, transform: 'translate(-50%, -50%)' }} />
      <div style={{ width: 0, height: 0, borderLeft: '17px solid white', borderTop: '11px solid transparent', borderBottom: '11px solid transparent', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))', transform: 'rotate(43deg)' }} />
    </div>
  )
}

function Shell({ scene, children }) {
  const frame = useCurrentFrame()
  const Icon = scene.icon
  const slide = clampInterpolate(frame, [0, 28], [28, 0])

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${scene.color}24, transparent 32%, ${palette.bg})` }} />
      <div style={{ display: 'flex', height: '100%', transform: `translateY(${slide}px)`, opacity: clampInterpolate(frame, [0, 20], [0, 1]) }}>
        <aside style={{ width: 238, background: palette.sidebar, borderRight: `1px solid ${palette.border}`, padding: '24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '0 10px' }}>
            <IconBubble icon={Bot} color={palette.cyan} size={38} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Agent Board</div>
              <div style={{ color: palette.muted, fontSize: 12 }}>Live operations</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {navItems.map(([label, icon]) => {
              const active = label === scene.nav
              return (
                <div key={label} style={{ height: 43, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 11, padding: '0 12px', background: active ? scene.color : 'transparent', color: active ? '#fff' : palette.muted, fontSize: 14, fontWeight: active ? 800 : 600 }}>
                  {createElement(icon, { size: 17 })}
                  {label}
                </div>
              )
            })}
          </div>
        </aside>
        <main style={{ flex: 1, minWidth: 0, background: palette.main }}>
          <header style={{ height: 68, background: palette.sidebar, borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconBubble icon={Icon} color={scene.color} size={38} />
              <div>
                <div style={{ color: scene.color, fontSize: 13, fontWeight: 900 }}>{scene.group}</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{scene.title}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: palette.muted, fontSize: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: palette.green, boxShadow: `0 0 14px ${palette.green}` }} />
              Live sync
              <div style={{ width: 36, height: 36, borderRadius: 999, background: palette.blue, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>VB</div>
            </div>
          </header>
          <section style={{ padding: 28, position: 'relative', height: 'calc(100% - 68px)' }}>
            {children}
          </section>
        </main>
      </div>
      <div style={{ position: 'absolute', left: 276, right: 38, bottom: 24, height: 64, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderRadius: 14, background: 'rgba(15, 23, 42, 0.88)', border: `1px solid ${palette.border}`, backdropFilter: 'blur(12px)' }}>
        <IconBubble icon={Icon} color={scene.color} size={40} />
        <div style={{ fontSize: 22, fontWeight: 800 }}>{scene.line}</div>
      </div>
      <Cursor color={scene.color} />
    </AbsoluteFill>
  )
}

function Dashboard() {
  const metrics = [
    [Users, 'Active Agents', '8', palette.green],
    [Circle, 'Idle Agents', '3', palette.muted],
    [AlertTriangle, 'Blocked', '1', palette.yellow],
    [DollarSign, 'Cost Today', '$18.42', palette.green],
    [Zap, 'Tokens Today', '2.1M', palette.violet],
    [Radio, 'Live Events', '127', palette.cyan],
  ]
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {metrics.map(([icon, label, value, color], index) => (
          <Reveal key={label} delay={index * 5}>
            <Card style={{ height: 116, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
              <IconBubble icon={icon} color={color} />
              <div>
                <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{value}</div>
                <div style={{ marginTop: 7, color: palette.muted, fontSize: 14 }}>{label}</div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.85fr', gap: 18, marginTop: 18 }}>
        <Reveal delay={34}>
          <Card style={{ height: 430, padding: 22 }}>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 24 }}>Tickets by Status</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30, height: 270 }}>
              {[
                ['Todo', 54, palette.muted],
                ['Progress', 82, palette.blue],
                ['Review', 44, palette.yellow],
                ['Done', 92, palette.green],
                ['Blocked', 22, palette.red],
              ].map(([label, value, color], index) => (
                <div key={label} style={{ flex: 1, display: 'grid', gap: 10, alignItems: 'end' }}>
                  <Progress value={value} color={color} delay={44 + index * 6} />
                  <div style={{ height: 220, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${value}%`, borderRadius: '10px 10px 3px 3px', background: color }} />
                  </div>
                  <div style={{ color: palette.muted, textAlign: 'center', fontSize: 13 }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={46}>
          <Card style={{ height: 430, padding: 22 }}>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>Recent Activity</div>
            {['session.started', 'ticket.updated', 'agent.updated', 'github.webhook', 'session.ended'].map((event, index) => (
              <Reveal key={event} delay={62 + index * 10}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: index ? `1px solid ${palette.border}` : 0 }}>
                  <IconBubble icon={Activity} color={index % 2 ? palette.cyan : palette.green} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{event}</div>
                    <div style={{ color: palette.muted, fontSize: 13 }}>{index + 1} min ago</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </Card>
        </Reveal>
      </div>
    </>
  )
}

function Board() {
  const frame = useCurrentFrame()
  const columns = [
    ['Todo', palette.muted, ['Add webhook delivery logs', 'Audit sprint metrics', 'Clean stale keys']],
    ['In Progress', palette.blue, ['Build trace viewer', 'Wire broadcasts', 'Render product demo']],
    ['Review', palette.yellow, ['Leaderboard rules', 'Ticket changes endpoint']],
    ['Done', palette.green, ['Persistent login', 'Token cost overview', 'Agent sparklines']],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {columns.map(([title, color, cards], columnIndex) => (
        <Reveal key={title} delay={columnIndex * 9}>
          <Card style={{ minHeight: 690, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 18, fontWeight: 900 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: color }} />
                {title}
              </div>
              <span style={{ color: palette.muted }}>{cards.length}</span>
            </div>
            {cards.map((card, cardIndex) => {
              const active = columnIndex === 1 && cardIndex === 2
              const x = active ? clampInterpolate(frame, [70, 118], [0, 65]) : 0
              const y = active ? clampInterpolate(frame, [70, 118], [0, -38]) : 0
              return (
                <div key={card} style={{ padding: 16, borderRadius: 10, background: active ? '#243b64' : palette.panel, border: `1px solid ${active ? palette.blue : palette.border}`, marginBottom: 13, transform: `translate(${x}px, ${y}px)`, boxShadow: active ? `0 16px 36px ${palette.blue}44` : 'none' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.35 }}>{card}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <span style={{ fontSize: 12, color, border: `1px solid ${color}66`, borderRadius: 999, padding: '4px 9px' }}>P{Math.min(columnIndex + 1, 3)}</span>
                    <span style={{ fontSize: 12, color: palette.muted, border: `1px solid ${palette.border}`, borderRadius: 999, padding: '4px 9px' }}>agent</span>
                  </div>
                </div>
              )
            })}
          </Card>
        </Reveal>
      ))}
    </div>
  )
}

function Ticket() {
  const events = [
    [Bot, 'Session started', 'Claude Builder connected', palette.blue],
    [Search, 'Read project context', '12 files inspected', palette.cyan],
    [Code2, 'Edited tracking.py', '+86 lines, -12 lines', palette.yellow],
    [GitBranch, 'Broadcast emitted', 'session.ended pushed live', palette.violet],
    [CheckCircle2, 'Verification passed', 'server import clean', palette.green],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 18 }}>
      <Reveal>
        <Card style={{ height: 700, padding: 22 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            {['Overview', 'Performance', 'Changes', 'Trace'].map((tab, index) => (
              <div key={tab} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${palette.border}`, background: index > 1 ? palette.blue : palette.panel, fontWeight: 800 }}>{tab}</div>
            ))}
          </div>
          {events.map(([icon, label, meta, color], index) => (
            <Reveal key={label} delay={18 + index * 14}>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14, minHeight: 98 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <IconBubble icon={icon} color={color} size={40} />
                  {index < events.length - 1 && <div style={{ flex: 1, width: 2, background: palette.border }} />}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900 }}>{label}</div>
                  <div style={{ color: palette.muted, marginTop: 5 }}>{meta}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </Card>
      </Reveal>
      <Reveal delay={18}>
        <Card style={{ height: 700, padding: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>Code Changes</div>
          {[
            ['backend/app/routes/tracking.py', '+142', '-18', palette.green],
            ['frontend/src/hooks/useSocket.js', '+96', '-0', palette.blue],
            ['frontend/src/pages/BoardPage.jsx', '+44', '-7', palette.yellow],
            ['backend/app/realtime.py', '+67', '-0', palette.violet],
          ].map((row, index) => (
            <Reveal key={row[0]} delay={34 + index * 13}>
              <div style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 900 }}>{row[0]}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: palette.green }}>{row[1]}</span>
                    <span style={{ color: palette.red }}>{row[2]}</span>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}><Progress value={80 - index * 11} color={row[3]} delay={48 + index * 13} /></div>
              </div>
            </Reveal>
          ))}
        </Card>
      </Reveal>
    </div>
  )
}

function Agents() {
  return <DataTable rows={[
    ['Claude Builder', 'sonnet-4.5', 'active', '1.28M', '$13.44'],
    ['Frontend Fixer', 'gpt-5.4', 'active', '820K', '$8.02'],
    ['QA Verifier', 'codex', 'idle', '314K', '$2.91'],
    ['API Worker', 'sonnet-4.5', 'blocked', '557K', '$4.20'],
    ['Prompt Auditor', 'gpt-5.4', 'active', '244K', '$2.13'],
  ]} headers={['Agent', 'Model', 'Status', 'Tokens', 'Cost']} />
}

function Profile() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
      <Reveal>
        <Card style={{ height: 700, padding: 24, textAlign: 'center' }}>
          <div style={{ width: 112, height: 112, margin: '20px auto', borderRadius: 999, background: `${palette.violet}22`, color: palette.violet, display: 'grid', placeItems: 'center', fontSize: 42, fontWeight: 900 }}>CB</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>Claude Builder</div>
          <div style={{ color: palette.muted, marginTop: 8 }}>sonnet-4.5 / active</div>
          <div style={{ display: 'grid', gap: 16, marginTop: 34 }}>
            {[
              ['Reliability', 94, palette.green],
              ['Speed', 87, palette.blue],
              ['Review pass', 91, palette.violet],
            ].map(([label, value, color], index) => (
              <div key={label} style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>{label}</span><span>{value}%</span></div>
                <Progress value={value} color={color} delay={24 + index * 18} />
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
      <Reveal delay={18}>
        <Card style={{ height: 700, padding: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>Recent Runs</div>
          {['Build trace viewer', 'Fix auth persistence', 'Add sparkline endpoint', 'Review ticket diff'].map((run, index) => (
            <Reveal key={run} delay={30 + index * 18}>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 110px', alignItems: 'center', gap: 14, padding: 18, marginBottom: 14, background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10 }}>
                <IconBubble icon={CheckCircle2} color={index === 1 ? palette.blue : palette.green} size={38} />
                <div><div style={{ fontWeight: 900 }}>{run}</div><div style={{ color: palette.muted, fontSize: 13 }}>{index + 2} files touched</div></div>
                <div style={{ color: palette.green, textAlign: 'right', fontWeight: 900 }}>passed</div>
              </div>
            </Reveal>
          ))}
        </Card>
      </Reveal>
    </div>
  )
}

function Leaderboard() {
  return <RankCards items={[
    ['Claude Builder', '98', palette.yellow],
    ['Frontend Fixer', '94', palette.green],
    ['Prompt Auditor', '91', palette.violet],
    ['QA Verifier', '86', palette.blue],
  ]} />
}

function Teams() {
  return <GridCards items={[
    ['Platform', '4 agents', palette.blue],
    ['Frontend', '3 agents', palette.green],
    ['QA Review', '2 agents', palette.yellow],
    ['Marketing', '5 agents', palette.rose],
    ['Automation', '3 agents', palette.violet],
    ['Ops', '2 agents', palette.cyan],
  ]} />
}

function Projects() {
  return <GridCards items={[
    ['Agent Board', 'active sprint', palette.cyan],
    ['Marketing Video', 'in review', palette.rose],
    ['Realtime Tracking', 'shipping', palette.green],
    ['GitHub Webhooks', 'connected', palette.blue],
    ['Cost Analytics', 'monitoring', palette.yellow],
    ['Prompt Agents', 'drafting', palette.violet],
  ]} />
}

function Sprints() {
  return <RankCards items={[
    ['Sprint 12: Realtime Layer', '82%', palette.green],
    ['Sprint 13: Video Launch', '64%', palette.rose],
    ['Sprint 14: Prompt Agents', '41%', palette.violet],
  ]} progress />
}

function SprintDetail() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Reveal><Card style={{ height: 690, padding: 24 }}><div style={{ fontSize: 26, fontWeight: 900 }}>Sprint Goal</div><p style={{ color: palette.muted, fontSize: 20, lineHeight: 1.5 }}>Ship a visible, auditable operating layer for agent work.</p><Progress value={73} color={palette.rose} delay={28} /><div style={{ marginTop: 28 }}><DataList items={['Trace tab ready', 'Code changes visible', 'Leaderboard scored', 'Video package drafted']} /></div></Card></Reveal>
      <Reveal delay={18}><Card style={{ height: 690, padding: 24 }}><div style={{ fontSize: 26, fontWeight: 900 }}>Team Load</div>{['Claude Builder', 'Frontend Fixer', 'QA Verifier', 'Prompt Auditor'].map((item, index) => <div key={item} style={{ marginTop: 24 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>{item}</span><span>{68 + index * 6}%</span></div><Progress value={68 + index * 6} color={[palette.blue, palette.green, palette.yellow, palette.violet][index]} delay={34 + index * 14} /></div>)}</Card></Reveal>
    </div>
  )
}

function Standups() {
  return <DataList large items={[
    'Claude Builder: trace viewer is ready for review.',
    'Frontend Fixer: board animation and state polish in progress.',
    'QA Verifier: checking generated artifacts and audio sync.',
    'Prompt Auditor: tightening marketing agent instructions.',
  ]} />
}

function ActivityScene() {
  return <DataList large items={[
    'session.started / Claude Builder / just now',
    'ticket.updated / Render full product tour / 1 min ago',
    'agent.updated / Prompt Auditor / 2 min ago',
    'github.webhook / tracking.py changed / 4 min ago',
    'session.ended / QA Verifier / 5 min ago',
  ]} />
}

function SettingsAgents() {
  return <GridCards items={[
    ['Builder', 'code + review', palette.blue],
    ['Verifier', 'tests + QA', palette.green],
    ['Prompt Auditor', 'prompt quality', palette.violet],
    ['Video Editor', 'timeline sync', palette.rose],
    ['Sound Designer', 'music + SFX', palette.yellow],
    ['Marketing Strategist', 'launch story', palette.cyan],
  ]} />
}

function SettingsTeams() {
  return <GridCards items={[
    ['Engineering', 'default reviewers', palette.blue],
    ['Design', 'creative assets', palette.rose],
    ['Marketing', 'launch agents', palette.yellow],
    ['Operations', 'admin access', palette.green],
  ]} />
}

function SettingsProjects() {
  return <DataTable rows={[
    ['Agent Board', 'active', 'engineering', '8 agents'],
    ['Video Launch', 'review', 'marketing', '5 agents'],
    ['Webhook Layer', 'active', 'platform', '3 agents'],
    ['Prompt System', 'draft', 'AI ops', '4 agents'],
  ]} headers={['Project', 'Status', 'Team', 'Agents']} />
}

function SettingsUsers() {
  return <DataTable rows={[
    ['Vineet', 'admin', 'all projects', 'active'],
    ['Reviewer', 'reviewer', 'video launch', 'invited'],
    ['Operator', 'member', 'agent board', 'active'],
  ]} headers={['User', 'Role', 'Scope', 'Status']} />
}

function SettingsGithub() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 18 }}>
      <Reveal><Card style={{ height: 690, padding: 24 }}><IconBubble icon={GitBranch} color={palette.blue} size={68} /><div style={{ fontSize: 28, fontWeight: 900, marginTop: 24 }}>GitHub Connected</div><p style={{ color: palette.muted, fontSize: 20, lineHeight: 1.5 }}>Commits, pull requests, and file changes are linked back to agent sessions.</p><Progress value={100} color={palette.green} delay={42} /></Card></Reveal>
      <Reveal delay={16}><DataList large items={['webhook.received / pull_request.opened', 'commit.linked / tracking.py', 'diff.indexed / +142 -18', 'ticket.updated / code changes attached']} /></Reveal>
    </div>
  )
}

function Login() {
  const frame = useCurrentFrame()
  const fill = clampInterpolate(frame, [42, 94], [0, 100])
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <Reveal>
        <Card style={{ width: 440, padding: 34 }}>
          <IconBubble icon={Shield} color={palette.blue} size={58} />
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 24 }}>Welcome back</div>
          <div style={{ color: palette.muted, marginTop: 8 }}>Sign in to Agent Board</div>
          <div style={{ marginTop: 28, display: 'grid', gap: 14 }}>
            <div style={{ height: 48, borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, display: 'flex', alignItems: 'center', padding: '0 14px', color: palette.muted }}>vineet@example.com</div>
            <div style={{ height: 48, borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, display: 'flex', alignItems: 'center', padding: '0 14px', color: palette.muted }}>{'•'.repeat(Math.round(fill / 12))}</div>
            <div style={{ height: 48, borderRadius: 8, background: palette.blue, display: 'grid', placeItems: 'center', fontWeight: 900 }}>Sign in</div>
          </div>
        </Card>
      </Reveal>
    </div>
  )
}

function DataTable({ headers, rows }) {
  return (
    <Reveal>
      <Card style={{ padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${headers.length}, 1fr)`, gap: 12, color: palette.muted, fontSize: 14, padding: '0 10px 12px' }}>
          {headers.map((header) => <div key={header}>{header}</div>)}
        </div>
        {rows.map((row, rowIndex) => (
          <Reveal key={row.join('-')} delay={18 + rowIndex * 14}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${headers.length}, 1fr)`, gap: 12, alignItems: 'center', minHeight: 72, background: rowIndex % 2 ? palette.panel : palette.card2, border: `1px solid ${palette.border}`, borderRadius: 10, marginBottom: 12, padding: '0 18px' }}>
              {row.map((cell, index) => <div key={`${cell}-${index}`} style={{ color: index === 0 ? palette.text : palette.muted, fontWeight: index === 0 ? 900 : 700 }}>{cell}</div>)}
            </div>
          </Reveal>
        ))}
      </Card>
    </Reveal>
  )
}

function GridCards({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
      {items.map(([title, meta, color], index) => (
        <Reveal key={title} delay={index * 12}>
          <Card style={{ height: 214, padding: 22 }}>
            <IconBubble icon={FolderKanban} color={color} size={48} />
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 24 }}>{title}</div>
            <div style={{ color: palette.muted, marginTop: 8, fontSize: 16 }}>{meta}</div>
            <div style={{ marginTop: 24 }}><Progress value={58 + index * 6} color={color} delay={28 + index * 12} /></div>
          </Card>
        </Reveal>
      ))}
    </div>
  )
}

function RankCards({ items, progress = false }) {
  return (
    <Card style={{ padding: 24 }}>
      {items.map(([name, score, color], index) => (
        <Reveal key={name} delay={index * 16}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px', alignItems: 'center', gap: 16, minHeight: 104, background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: `${color}22`, color, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 900 }}>#{index + 1}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{name}</div>
              <div style={{ color: palette.muted, marginTop: 6 }}>{progress ? 'Sprint progress' : 'Agent performance score'}</div>
              {progress && <div style={{ marginTop: 12 }}><Progress value={parseInt(score, 10)} color={color} delay={24 + index * 16} /></div>}
            </div>
            <div style={{ color, fontSize: 34, fontWeight: 900, textAlign: 'right' }}>{score}</div>
          </div>
        </Reveal>
      ))}
    </Card>
  )
}

function DataList({ items, large = false }) {
  return (
    <Card style={{ padding: large ? 24 : 0, height: large ? 690 : 'auto' }}>
      {items.map((item, index) => (
        <Reveal key={item} delay={index * 15}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: large ? 20 : '14px 0', borderBottom: index < items.length - 1 ? `1px solid ${palette.border}` : 0 }}>
            <IconBubble icon={index % 2 ? Radio : CheckCircle2} color={[palette.blue, palette.green, palette.yellow, palette.violet, palette.cyan][index % 5]} size={40} />
            <div style={{ fontSize: large ? 20 : 16, fontWeight: 800 }}>{item}</div>
          </div>
        </Reveal>
      ))}
    </Card>
  )
}

const componentMap = {
  dashboard: Dashboard,
  board: Board,
  ticket: Ticket,
  agents: Agents,
  profile: Profile,
  leaderboard: Leaderboard,
  teams: Teams,
  projects: Projects,
  sprints: Sprints,
  sprintDetail: SprintDetail,
  standups: Standups,
  activity: ActivityScene,
  settingsAgents: SettingsAgents,
  settingsTeams: SettingsTeams,
  settingsProjects: SettingsProjects,
  settingsUsers: SettingsUsers,
  settingsGithub: SettingsGithub,
  login: Login,
}

function Intro() {
  const frame = useCurrentFrame()
  const scale = clampInterpolate(frame, [12, 70], [0.92, 1])
  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${palette.cyan}20, transparent 45%, ${palette.violet}20)` }} />
      <div style={{ textAlign: 'center', width: 1120, opacity: clampInterpolate(frame, [0, 30], [0, 1]), transform: `scale(${scale})` }}>
        <IconBubble icon={Bot} color={palette.cyan} size={76} />
        <h1 style={{ fontSize: 100, lineHeight: 1, margin: '30px 0 0', fontWeight: 900, letterSpacing: 0 }}>Agent Board</h1>
        <p style={{ color: palette.muted, fontSize: 32, lineHeight: 1.42, margin: '28px auto 0', width: 940 }}>
          An animated tour of the operating system for AI agent teams.
        </p>
      </div>
    </AbsoluteFill>
  )
}

function Scene({ scene }) {
  const Component = componentMap[scene.type]
  return (
    <Shell scene={scene}>
      <Component />
    </Shell>
  )
}

function Outro() {
  const frame = useCurrentFrame()
  const y = clampInterpolate(frame, [0, 34], [34, 0])
  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${palette.green}1f, transparent 42%, ${palette.blue}1f)` }} />
      <div style={{ width: 1160, textAlign: 'center', transform: `translateY(${y}px)`, opacity: clampInterpolate(frame, [0, 28], [0, 1]) }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: palette.green, fontSize: 22, fontWeight: 900, marginBottom: 26 }}>
          <CheckCircle2 size={25} />
          Every screen is connected
        </div>
        <h1 style={{ fontSize: 84, lineHeight: 1, margin: 0, fontWeight: 900, letterSpacing: 0 }}>Run the agent team from one board.</h1>
        <p style={{ width: 900, margin: '30px auto 0', color: palette.muted, fontSize: 30, lineHeight: 1.42 }}>
          Planning, monitoring, settings, code visibility, and team rhythm in one operational workspace.
        </p>
      </div>
    </AbsoluteFill>
  )
}

export function AgentBoardAnimatedTour() {
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <Sequence from={0} durationInFrames={introFrames}>
        <Intro />
      </Sequence>
      {scenes.map((scene, index) => (
        <Sequence key={scene.key} from={introFrames + index * sceneFrames} durationInFrames={sceneFrames}>
          <Scene scene={scene} />
        </Sequence>
      ))}
      <Sequence from={introFrames + scenes.length * sceneFrames} durationInFrames={outroFrames}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  )
}

export { scenes, introFrames, sceneFrames, outroFrames, fps }
