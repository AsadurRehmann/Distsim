import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';
import { getProtocolGuide } from './ProtocolGuideContent';

export function ProtocolGuideDrawer() {
  const protocol = useSimulationStore(s => s.protocol);
  const guide = getProtocolGuide(protocol);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[340px] sm:w-[400px] bg-card border-border overflow-y-auto scrollbar-thin"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-mono text-primary text-lg tracking-wide">
            {guide.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 font-outfit">
          {/* Overview */}
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              How it works
            </h3>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {guide.overview}
            </p>
          </section>

          {/* Animations key */}
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">
              What each animation means
            </h3>
            <ul className="space-y-3">
              {guide.animations.map((anim, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  <span className="text-primary font-semibold">{anim.term}</span>
                  <span className="text-foreground/70"> — {anim.description}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Try breaking */}
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">
              Try breaking it
            </h3>
            <ul className="space-y-2">
              {guide.tryBreaking.map((tip, i) => (
                <li key={i} className="text-sm text-foreground/80 leading-relaxed flex gap-2">
                  <span className="text-destructive font-mono text-xs mt-0.5 shrink-0">▸</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
