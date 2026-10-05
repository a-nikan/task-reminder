import { useState } from 'react';
import { useStore } from '../store';
import { cn } from '../utils';
import { CheckCircle, Bell, Calendar, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

const steps = [
  {
    title: 'به Nick Task Reminder خوش آمدید!',
    description: 'اولین تسک خود را ایجاد کنید',
    icon: <CheckCircle className="w-12 h-12 text-primary" />,
  },
  {
    title: 'یادآوری تنظیم کنید',
    description: 'هیچ کاری را فراموش نکنید',
    icon: <Bell className="w-12 h-12 text-primary" />,
  },
  {
    title: 'تقویم خود را مدیریت کنید',
    description: 'برنامه‌ریزی روزانه و هفتگی',
    icon: <Calendar className="w-12 h-12 text-primary" />,
  },
  {
    title: 'آماده شروع!',
    description: 'همه چیز آماده است. موفق باشید!',
    icon: <Sparkles className="w-12 h-12 text-primary" />,
  },
];

export function Onboarding() {
  const { setOnboardingComplete, updateSettings } = useStore();
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    updateSettings({ onboardingComplete: 'true' });
    setOnboardingComplete(true);
  };

  const handleSkip = () => {
    handleComplete();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-md">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-8 text-center animate-slide-up">
          <div className="mb-6 flex justify-center">
            {steps[step].icon}
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{steps[step].title}</h2>
          <p className="text-sm text-muted-foreground mb-8">{steps[step].description}</p>

          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <div key={i} className={cn('w-2 h-2 rounded-full transition-all', i === step ? 'bg-primary w-6' : 'bg-muted')} />
            ))}
          </div>

          <div className="flex gap-3">
            {step < steps.length - 1 ? (
              <>
                <button onClick={handleSkip} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors">
                  رد شدن
                </button>
                <button onClick={() => setStep(step + 1)} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  بعدی
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={handleComplete} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                شروع کنید!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
