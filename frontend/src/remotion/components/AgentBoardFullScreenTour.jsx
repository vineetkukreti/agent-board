import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { Activity, Bot, CheckCircle2, Cog, FolderKanban, Kanban, Lock, MessageSquare, Radio, Trophy, Users, Zap } from 'lucide-react'
/* eslint-disable react-refresh/only-export-components */

const palette = {
  bg: '#050814',
  panel: '#0f172a',
  panel2: '#111827',
  text: '#f8fafc',
  muted: '#94a3b8',
  border: '#243044',
  accent: '#22d3ee',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  violet: '#8b5cf6',
  rose: '#ec4899',
}

const screens = [
  {
    id: 'iUttd',
    title: 'Dashboard',
    group: 'Overview',
    icon: Activity,
    color: palette.blue,
    image: 'iUttd.png',
    line: 'Live command center for agents, sessions, tickets, token usage, cost, and activity.',
  },
  {
    id: 'X9nBI',
    title: 'Board / Kanban',
    group: 'Workflow',
    icon: Kanban,
    color: palette.accent,
    image: 'X9nBI.png',
    line: 'Track AI work from todo, to in progress, review, and done.',
  },
  {
    id: 'X3cD5',
    title: 'Board / Ticket Detail',
    group: 'Workflow',
    icon: CheckCircle2,
    color: palette.green,
    image: 'X3cD5.png',
    line: 'Open a ticket and review ownership, notes, traces, and code-level delivery.',
  },
  {
    id: '9WdTI',
    title: 'Agents / Fleet',
    group: 'Agents',
    icon: Bot,
    color: palette.violet,
    image: '9WdTI.png',
    line: 'Monitor every agent, model, status, heartbeat, token usage, and cost.',
  },
  {
    id: 'Z1KKvs',
    title: 'Agents / Profile',
    group: 'Agents',
    icon: Users,
    color: palette.violet,
    image: 'Z1KKvs.png',
    line: 'Drill into one agent to inspect recent runs, performance, and work history.',
  },
  {
    id: 'DwhyK',
    title: 'Leaderboard',
    group: 'Performance',
    icon: Trophy,
    color: palette.yellow,
    image: 'DwhyK.png',
    line: 'Compare throughput, reliability, responsiveness, and contribution quality.',
  },
  {
    id: 'pPpgY',
    title: 'Teams',
    group: 'Organization',
    icon: Users,
    color: palette.green,
    image: 'pPpgY.png',
    line: 'Group agents and people into teams so ownership stays clear.',
  },
  {
    id: 'V3Gf1',
    title: 'Projects',
    group: 'Organization',
    icon: FolderKanban,
    color: palette.blue,
    image: 'V3Gf1.png',
    line: 'Organize work by project and keep each agent aligned to the right context.',
  },
  {
    id: 'xk94f',
    title: 'Sprints / List',
    group: 'Planning',
    icon: Zap,
    color: palette.rose,
    image: 'xk94f.png',
    line: 'Plan focused delivery cycles and see sprint health at a glance.',
  },
  {
    id: '88p2G',
    title: 'Sprints / Detail',
    group: 'Planning',
    icon: Zap,
    color: palette.rose,
    image: '88p2G.png',
    line: 'Open a sprint to track goals, progress, team load, and completion status.',
  },
  {
    id: 'k5ifwH',
    title: 'Standups',
    group: 'Rhythm',
    icon: MessageSquare,
    color: palette.accent,
    image: 'k5ifwH.png',
    line: 'Capture daily updates from people and agents in one operational rhythm.',
  },
  {
    id: 'g9CJl',
    title: 'Activity',
    group: 'Realtime',
    icon: Radio,
    color: palette.green,
    image: 'g9CJl.png',
    line: 'Audit live events, session changes, ticket updates, and system movement.',
  },
  {
    id: 'ZqdXJ',
    title: 'Settings / Agent Types',
    group: 'Settings',
    icon: Cog,
    color: palette.yellow,
    image: 'ZqdXJ.png',
    line: 'Define agent roles and capabilities so new workers start with the right behavior.',
  },
  {
    id: 'jnXHE',
    title: 'Settings / Teams',
    group: 'Settings',
    icon: Cog,
    color: palette.yellow,
    image: 'jnXHE.png',
    line: 'Configure the team layer that connects agents, projects, and accountability.',
  },
  {
    id: 'V7KMT0',
    title: 'Settings / Projects',
    group: 'Settings',
    icon: Cog,
    color: palette.yellow,
    image: 'V7KMT0.png',
    line: 'Control project setup and keep workspaces clean as agent usage grows.',
  },
  {
    id: 'R7BELQ',
    title: 'Settings / Users',
    group: 'Settings',
    icon: Cog,
    color: palette.yellow,
    image: 'R7BELQ.png',
    line: 'Manage users, permissions, and review access for the operating team.',
  },
  {
    id: 't8ykWa',
    title: 'Settings / GitHub',
    group: 'Settings',
    icon: Cog,
    color: palette.yellow,
    image: 't8ykWa.png',
    line: 'Connect GitHub activity so code changes and agent work stay traceable.',
  },
  {
    id: 'yXWH5',
    title: 'Login',
    group: 'Access',
    icon: Lock,
    color: palette.blue,
    image: 'yXWH5.png',
    line: 'Persistent access keeps teams inside the same command center.',
  },
]

const introFrames = 120
const screenFrames = 150
const outroFrames = 150
export const fullTourDuration = introFrames + screens.length * screenFrames + outroFrames

function ease(frame, input, output) {
  return interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
}

function usePop(frame, delay = 0) {
  const { fps } = useVideoConfig()
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 17, stiffness: 105 },
  })
}

function TopRail({ activeIndex }) {
  return (
    <div style={{ position: 'absolute', top: 30, left: 54, right: 54, display: 'flex', gap: 7, zIndex: 6 }}>
      {screens.map((screen, index) => (
        <div
          key={screen.id}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 99,
            background: index <= activeIndex ? screen.color : 'rgba(148, 163, 184, 0.24)',
            boxShadow: index === activeIndex ? `0 0 22px ${screen.color}77` : 'none',
          }}
        />
      ))}
    </div>
  )
}

function Intro() {
  const frame = useCurrentFrame()
  const scale = interpolate(usePop(frame, 8), [0, 1], [0.94, 1])
  const opacity = ease(frame, [0, 18], [0, 1])

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(34, 211, 238, 0.24), transparent 42%)' }} />
      <div style={{ position: 'absolute', inset: 70, border: `1px solid ${palette.border}`, borderRadius: 28, opacity: 0.7 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity }}>
        <div style={{ width: 1180, textAlign: 'center', transform: `scale(${scale})` }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 999, background: 'rgba(34, 211, 238, 0.12)', color: palette.accent, border: `1px solid ${palette.accent}66`, fontSize: 24, fontWeight: 700, marginBottom: 30 }}>
            <Bot size={26} />
            Full product tour
          </div>
          <h1 style={{ fontSize: 104, lineHeight: 1, margin: 0, fontWeight: 900, letterSpacing: 0 }}>Agent Board</h1>
          <p style={{ width: 960, margin: '28px auto 0', fontSize: 34, lineHeight: 1.35, color: palette.muted }}>
            A command center for planning, monitoring, and auditing AI agent work across every screen.
          </p>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function ScreenSlide({ screen, index }) {
  const frame = useCurrentFrame()
  const Icon = screen.icon
  const imageOpacity = ease(frame, [0, 18, screenFrames - 22, screenFrames], [0, 1, 1, 0])
  const imageScale = ease(frame, [0, screenFrames], [1.015, 1.075])
  const panelY = ease(frame, [8, 28], [34, 0])
  const panelOpacity = ease(frame, [8, 28, screenFrames - 18, screenFrames], [0, 1, 1, 0])
  const calloutX = ease(frame, [24, 44], [-34, 0])
  const screenNumber = String(index + 1).padStart(2, '0')

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', overflow: 'hidden' }}>
      <TopRail activeIndex={index} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${screen.color}28, transparent 34%, ${palette.bg} 100%)` }} />
      <div style={{ position: 'absolute', inset: '74px 74px 128px', borderRadius: 24, overflow: 'hidden', border: `1px solid ${palette.border}`, boxShadow: '0 34px 90px rgba(0, 0, 0, 0.42)', opacity: imageOpacity }}>
        <Img
          src={staticFile(`agent-tracker-screens/${screen.image}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${imageScale}) translateY(${index % 2 ? '-0.7%' : '0.7%'})`,
          }}
        />
      </div>
      <div style={{ position: 'absolute', left: 74, right: 74, bottom: 34, height: 78, display: 'flex', alignItems: 'center', gap: 16, opacity: panelOpacity, transform: `translateY(${panelY}px)` }}>
        <div style={{ width: 78, height: 78, borderRadius: 18, display: 'grid', placeItems: 'center', background: `${screen.color}22`, color: screen.color, border: `1px solid ${screen.color}66` }}>
          <Icon size={34} />
        </div>
        <div style={{ minWidth: 310 }}>
          <div style={{ color: screen.color, fontSize: 18, fontWeight: 800 }}>{screenNumber} / {screen.group}</div>
          <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 900, marginTop: 4 }}>{screen.title}</div>
        </div>
        <div style={{ flex: 1, color: palette.text, fontSize: 24, lineHeight: 1.28, transform: `translateX(${calloutX}px)` }}>
          {screen.line}
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Outro() {
  const frame = useCurrentFrame()
  const opacity = ease(frame, [0, 24], [0, 1])
  const y = ease(frame, [0, 28], [34, 0])

  return (
    <AbsoluteFill style={{ background: palette.bg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, rgba(34, 211, 238, 0.18), transparent 45%, rgba(139, 92, 246, 0.14))' }} />
      <div style={{ width: 1180, textAlign: 'center', opacity, transform: `translateY(${y}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: palette.green, fontSize: 22, fontWeight: 800, marginBottom: 26 }}>
          <CheckCircle2 size={25} />
          Every screen, one operating system
        </div>
        <h1 style={{ fontSize: 88, lineHeight: 1, margin: 0, fontWeight: 900, letterSpacing: 0 }}>Run the agent team from one board.</h1>
        <p style={{ width: 900, margin: '28px auto 0', color: palette.muted, fontSize: 30, lineHeight: 1.42 }}>
          Agent Board connects planning, monitoring, accountability, settings, and code visibility into one command center.
        </p>
      </div>
    </AbsoluteFill>
  )
}

export function AgentBoardFullScreenTour() {
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <Sequence from={0} durationInFrames={introFrames}>
        <Intro />
      </Sequence>
      {screens.map((screen, index) => (
        <Sequence key={screen.id} from={introFrames + index * screenFrames} durationInFrames={screenFrames}>
          <ScreenSlide screen={screen} index={index} />
        </Sequence>
      ))}
      <Sequence from={introFrames + screens.length * screenFrames} durationInFrames={outroFrames}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  )
}

export { screens, introFrames, screenFrames, outroFrames }
