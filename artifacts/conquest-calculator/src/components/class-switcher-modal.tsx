import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ClassMeta } from '@workspace/api-client-react';
import { ClassPortrait } from '@/components/class-portrait';

// ── ClassSwitcherModal ────────────────────────────────────────────────────────
// Uses ClassPortrait (official CoA sprite) for all class icon rendering.

interface ClassSwitcherModalProps {
  open: boolean;
  onClose: () => void;
  classes: ClassMeta[];
  selectedClassId: string | null;
  onSelect: (classId: string) => void;
}

export function ClassSwitcherModal({
  open,
  onClose,
  classes,
  selectedClassId,
  onSelect,
}: ClassSwitcherModalProps) {
  const handleSelect = (classId: string) => {
    onSelect(classId);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto w-[680px] max-h-[84vh] overflow-y-auto rounded-2xl"
              style={{
                background: 'linear-gradient(165deg, #15121e 0%, #0b0914 60%, #08070e 100%)',
                border: '1px solid rgba(200,168,75,0.16)',
                boxShadow: '0 28px 72px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid rgba(200,168,75,0.10)' }}
              >
                <div>
                  <div
                    className="text-[12px] font-bold uppercase tracking-[0.24em]"
                    style={{ color: '#c8a84b' }}
                  >
                    Choose Your Class
                  </div>
                  <div className="text-[9px] mt-0.5 tracking-[0.18em] uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {classes.length} classes · Conquest of Azeroth
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-md"
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                  }}
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Class grid — 3 cols */}
              <div className="p-4 grid grid-cols-3 gap-2">
                {classes.map(cls => {
                  const isActive = cls.id === selectedClassId;
                  return (
                    <motion.button
                      key={cls.id}
                      type="button"
                      onClick={() => handleSelect(cls.id)}
                      whileHover={{ scale: 1.025 }}
                      whileTap={{ scale: 0.975 }}
                      transition={{ duration: 0.12, ease: 'easeOut' }}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-left relative overflow-hidden"
                      style={{
                        background: isActive
                          ? `linear-gradient(135deg, ${cls.color}1e 0%, ${cls.color}0b 100%)`
                          : 'rgba(255,255,255,0.02)',
                        border: isActive
                          ? `1px solid ${cls.color}66`
                          : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isActive
                          ? `0 0 18px ${cls.color}22, inset 0 0 12px ${cls.color}0d`
                          : 'none',
                        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = `linear-gradient(135deg, ${cls.color}12 0%, ${cls.color}06 100%)`;
                          el.style.borderColor = `${cls.color}38`;
                          el.style.boxShadow = `0 0 10px ${cls.color}14`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = 'rgba(255,255,255,0.02)';
                          el.style.borderColor = 'rgba(255,255,255,0.06)';
                          el.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {/* Selected shimmer line at top */}
                      {isActive && (
                        <div
                          className="absolute inset-x-0 top-0 h-px pointer-events-none"
                          style={{ background: `linear-gradient(90deg, transparent, ${cls.color}77, transparent)` }}
                        />
                      )}

                      <ClassPortrait
                        classId={cls.id}
                        name={cls.name}
                        color={cls.color}
                        size={40}
                        glow={isActive}
                        selected={isActive}
                      />

                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[11.5px] font-bold leading-tight truncate"
                          style={{
                            color: isActive ? cls.color : '#c8c4dc',
                            textShadow: isActive ? `0 0 12px ${cls.color}44` : 'none',
                          }}
                        >
                          {cls.name}
                        </div>
                        {isActive ? (
                          <div
                            className="text-[8.5px] mt-0.5 uppercase tracking-[0.18em] font-bold"
                            style={{ color: '#c8a84b' }}
                          >
                            ✦ Selected
                          </div>
                        ) : (
                          <div
                            className="text-[8.5px] mt-0.5 uppercase tracking-[0.14em]"
                            style={{ color: 'rgba(255,255,255,0.2)' }}
                          >
                            class
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
