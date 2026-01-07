"use client";

import { ReactNode } from "react";
import { Check } from "lucide-react";

type StepperProps = {
  currentStep: number;
  steps: Array<{ label: string; key: string }>;
  onStepClick?: (step: number) => void;
  completedSteps?: number[];
};

export default function Stepper({
  currentStep,
  steps,
  onStepClick,
  completedSteps = [],
}: StepperProps) {
  return (
    <div className="w-full mb-8 overflow-x-auto overflow-y-visible">
      <div className="flex items-start justify-between min-w-full px-2 py-3">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = currentStep === stepNum;
          const isCompleted = completedSteps.includes(stepNum);
          const isClickable = onStepClick && (isCompleted || stepNum < currentStep);

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className="relative py-2">
                  <button
                    onClick={() => isClickable && onStepClick?.(stepNum)}
                    disabled={!isClickable}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0
                      transition-all relative z-10
                      ${isActive 
                        ? "bg-[var(--primary)] text-white shadow-md ring-4 ring-[var(--primary)] ring-opacity-20" 
                        : isCompleted
                        ? "bg-[var(--success)] text-white shadow-sm"
                        : "bg-[var(--border)] text-[var(--muted)]"
                      }
                      ${isClickable ? "cursor-pointer hover:scale-105" : "cursor-not-allowed"}
                    `}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : stepNum}
                  </button>
                </div>
                <span className={`mt-2 text-xs text-center px-1 leading-tight ${isActive ? "font-semibold text-[var(--primary)]" : "text-[var(--muted)]"}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mt-5 min-w-[20px] ${isCompleted || stepNum < currentStep ? "bg-[var(--success)]" : "bg-[var(--border)]"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

