import { LeftSidebar } from '@/components/LeftSidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { SimCanvas } from '@/components/SimCanvas';
import { useRaftSimulation } from '@/hooks/useRaftSimulation';
import { useGossipSimulation } from '@/hooks/useGossipSimulation';
import { useConsistentHashingSimulation } from '@/hooks/useConsistentHashingSimulation';
import { useVectorClocksSimulation } from '@/hooks/useVectorClocksSimulation';
import { useTwoPhaseCommitSimulation } from '@/hooks/useTwoPhaseCommitSimulation';

const Index = () => {
  useRaftSimulation();
  useGossipSimulation();
  useConsistentHashingSimulation();
  useVectorClocksSimulation();
  useTwoPhaseCommitSimulation();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <LeftSidebar />
      <SimCanvas />
      <RightSidebar />
    </div>
  );
};

export default Index;
