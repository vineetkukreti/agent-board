import { Composition } from 'remotion'
import { AgentBoardVideo } from './components/AgentBoardVideo'

export function RemotionRoot() {
  return (
    <Composition
      id="agent-board-demo"
      component={AgentBoardVideo}
      durationInFrames={1260}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        productName: 'Agent Board',
      }}
    />
  )
}
