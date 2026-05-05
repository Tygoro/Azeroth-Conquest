import type { ClassDetail, SpecMeta } from '@workspace/api-client-react';
import { Swords, Shield, Heart, Sparkles, Zap, Skull, type LucideIcon } from 'lucide-react';
import { CLASS_BG_GRADIENT } from '@/data/classes/icons';

interface SpecSelectionScreenProps {
  classDetail: ClassDetail;
  onSelectSpec: (specId: string) => void;
}

const ROLE_ICONS: Record<SpecMeta['role'], LucideIcon> = {
  damage: Swords,
  tank: Shield,
  healer: Heart,
  support: Sparkles,
};

const ROLE_LABELS: Record<SpecMeta['role'], string> = {
  damage: 'Damage',
  tank: 'Tank',
  healer: 'Healer',
  support: 'Support',
};

const ATTRIBUTE_LABELS: Record<SpecMeta['attribute'], string> = {
  strength: 'Strength',
  agility: 'Agility',
  intellect: 'Intellect',
  stamina: 'Stamina',
  spirit: 'Spirit',
};

const COMPLEXITY_COLORS: Record<SpecMeta['complexity'], string> = {
  easy: '#4ade80',
  normal: '#60a5fa',
  intermediate: '#fbbf24',
  advanced: '#f87171',
};

const COMPLEXITY_LABELS: Record<SpecMeta['complexity'], string> = {
  easy: 'Easy',
  normal: 'Normal',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function SpecSelectionScreen({ classDetail, onSelectSpec }: SpecSelectionScreenProps) {
  const bg = CLASS_BG_GRADIENT[classDetail.id] ?? 'radial-gradient(ellipse 90% 70% at 50% 0%, #0d0d14 0%, #050508 100%)';
  const color = classDetail.color;
  const specs = classDetail.specs ?? [];

  // Layout: 4 specs → 4 cols, 3 specs → 3 cols, 2 → 2 cols
  const colsClass =
    specs.length >= 4 ? 'lg:grid-cols-4 md:grid-cols-2'
    : specs.length === 3 ? 'lg:grid-cols-3 md:grid-cols-2'
    : 'md:grid-cols-2';

  return (
    <div className="relative w-full min-h-full">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: bg }} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, rgba(0,0,0,0.55) 100%)' }}
      />

      <div className="relative px-8 py-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-block text-[10px] font-bold tracking-[0.3em] uppercase px-4 py-1 rounded-full"
            style={{
              color,
              border: `1px solid ${color}55`,
              background: `linear-gradient(90deg, ${color}11 0%, ${color}22 100%)`,
            }}
          >
            Choose Your Specialization
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-wider" style={{ color }}>
            {classDetail.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {classDetail.description}
          </p>
        </div>

        {/* Spec cards grid (or empty-state fallback) */}
        {specs.length === 0 ? (
          <div
            className="text-center py-16 px-8 rounded-lg"
            style={{
              border: `1px dashed ${color}33`,
              background: `${color}08`,
            }}
          >
            <p className="text-sm font-semibold" style={{ color }}>
              No specializations available for this class.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Spec data may still be coming online — try refreshing in a moment.
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${colsClass} gap-5`}>
            {specs.map((spec) => (
              <SpecCard
                key={spec.id}
                spec={spec}
                classColor={color}
                onSelect={() => onSelectSpec(spec.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SpecCardProps {
  spec: SpecMeta;
  classColor: string;
  onSelect: () => void;
}

function SpecCard({ spec, classColor, onSelect }: SpecCardProps) {
  const RoleIcon: LucideIcon = ROLE_ICONS[spec.role] ?? Zap;
  const complexityColor = COMPLEXITY_COLORS[spec.complexity];

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`spec-card-${spec.id}`}
      className="group relative flex flex-col text-left rounded-lg overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 focus:outline-none focus-visible:ring-2"
      style={{
        background: 'linear-gradient(180deg, #0e0e18 0%, #06060c 100%)',
        border: `1px solid ${classColor}33`,
        boxShadow: `0 4px 24px ${classColor}11`,
      }}
    >
      {/* Hover glow border */}
      <div
        className="absolute inset-0 pointer-events-none rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          boxShadow: `inset 0 0 0 1px ${classColor}aa, 0 0 28px ${classColor}33`,
        }}
      />

      {/* Top art region */}
      <div
        className="relative h-44 flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(ellipse 70% 100% at 50% 50%, ${classColor}22 0%, transparent 70%)`,
        }}
      >
        {/* Decorative concentric rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-32 h-32 rounded-full"
            style={{ border: `1px solid ${classColor}22` }}
          />
          <div
            className="absolute w-44 h-44 rounded-full"
            style={{ border: `1px solid ${classColor}11` }}
          />
        </div>

        {/* Role icon centerpiece */}
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `radial-gradient(circle, ${classColor}33 0%, ${classColor}11 60%, transparent 100%)`,
            border: `2px solid ${classColor}66`,
            boxShadow: `0 0 24px ${classColor}44, inset 0 0 12px ${classColor}33`,
          }}
        >
          <RoleIcon className="w-10 h-10" style={{ color: classColor }} />
        </div>

        {/* Role badge bottom-left */}
        <div
          className="absolute bottom-2 left-2 text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded"
          style={{
            color: classColor,
            background: 'rgba(0,0,0,0.6)',
            border: `1px solid ${classColor}55`,
          }}
        >
          {ROLE_LABELS[spec.role]}
        </div>

        {/* Complexity badge bottom-right */}
        <div
          className="absolute bottom-2 right-2 text-[9px] font-bold tracking-[0.18em] uppercase px-2 py-0.5 rounded flex items-center gap-1"
          style={{
            color: complexityColor,
            background: 'rgba(0,0,0,0.6)',
            border: `1px solid ${complexityColor}55`,
          }}
        >
          <Skull className="w-2.5 h-2.5" />
          {COMPLEXITY_LABELS[spec.complexity]}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-wide" style={{ color: classColor }}>
            {spec.name}
          </h3>
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70 mt-0.5">
            {ATTRIBUTE_LABELS[spec.attribute]}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 flex-1">
          {spec.description}
        </p>

        {/* Sample spells */}
        {spec.sampleSpells.length > 0 && (
          <div className="border-t pt-3" style={{ borderColor: `${classColor}1a` }}>
            <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60 mb-1.5">
              Signature Spells
            </div>
            <div className="flex flex-wrap gap-1.5">
              {spec.sampleSpells.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: `${classColor}cc`,
                    background: `${classColor}11`,
                    border: `1px solid ${classColor}22`,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA hint */}
        <div
          className="text-center text-[10px] tracking-[0.25em] uppercase font-bold py-1.5 rounded mt-1 transition-all duration-200 group-hover:bg-opacity-100"
          style={{
            color: classColor,
            background: `${classColor}15`,
            border: `1px solid ${classColor}33`,
          }}
        >
          Select Spec →
        </div>
      </div>
    </button>
  );
}
