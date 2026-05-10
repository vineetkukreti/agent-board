import { Composition } from 'remotion'
import { AgentBoardVideo } from './components/AgentBoardVideo'
import { AgentBoardFullScreenTour, fullTourDuration } from './components/AgentBoardFullScreenTour'
import { AgentBoardAnimatedTour, animatedTourDuration } from './components/AgentBoardAnimatedTour'

export function RemotionRoot() {
  return (
    <>
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
      <Composition
        id="agent-board-full-screen-tour"
        component={AgentBoardFullScreenTour}
        durationInFrames={fullTourDuration}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="agent-board-animated-tour"
        component={AgentBoardAnimatedTour}
        durationInFrames={animatedTourDuration}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  )
}
