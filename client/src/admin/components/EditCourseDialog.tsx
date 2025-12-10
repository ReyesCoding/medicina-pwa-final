import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { hasScheduleConflict } from '@/utils/sections-processor';

// --- TIPOS ---
type Course = {
  id: string;
  name: string;
  credits: number;
  theoreticalHours: number;
  practicalHours: number;
  isElective?: boolean;
  electiveType?: 'general' | 'professional';
  term: number;
  area?: string;
  prerequisites?: string[];
  corequisites?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  course: Course;
  allCourses: Course[];
  onSave: (updated: Course) => void;
  getSectionsForCourse: (courseId: string) => any[];
  setSectionsForCourse: (courseId: string, nextList: any[]) => Promise<void>;
};

// --- HELPERS DE TIEMPO (ROBUSTOS) ---

// Normaliza la estructura del JSON para que la UI la entienda
function normalizeSections(list: any[]) {
  return list.map((sec) => ({
    ...sec,
    // La UI espera 'start' y 'end', el JSON usa 'startTime' y 'endTime'. Normalizamos aquí.
    schedule: (sec.schedule || []).map((b: any) => ({
      day: b.day,
      start: b.startTime ?? b.start, 
      end: b.endTime ?? b.end,
    })),
  }));
}

// Desnormaliza para guardar en el JSON con el formato correcto
function denormalizeSections(list: any[]) {
  return list.map((sec) => ({
    ...sec,
    schedule: (sec.schedule || []).map((b: any) => ({
      day: b.day,
      startTime: b.start, // Guardamos como startTime
      endTime: b.end,     // Guardamos como endTime
    })),
  }));
}

// Convierte "14:30" -> { time: "02:30", ap: "PM" }
function to12h(hhmm: string | undefined): { time: string; ap: 'AM' | 'PM' } {
  if (!hhmm) return { time: '07:00', ap: 'AM' };
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  
  if (isNaN(h)) h = 7; // Fallback seguro
  
  const ap: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  
  const t = `${String(h).padStart(2, '0')}:${m}`;
  return { time: t, ap };
}

// Convierte "02:30" + "PM" -> "14:30"
function to24h(time12: string, ap: 'AM' | 'PM'): string {
  const [hStr, mStr] = time12.split(':');
  let h = parseInt(hStr || '12', 10);
  let m = parseInt(mStr || '00', 10);

  // Validación estricta
  if (isNaN(h)) h = 12;
  if (isNaN(m)) m = 0;
  h = Math.max(1, Math.min(12, h));
  m = Math.max(0, Math.min(59, m));

  if (ap === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const DAY_OPTIONS = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
];

export default function EditCourseDialog({
  open,
  onClose,
  course,
  allCourses,
  onSave,
  getSectionsForCourse,
  setSectionsForCourse,
}: Props) {
  
  // --- ESTADO DEL FORMULARIO ---
  const [form, setForm] = useState<Course>(course);
  const [filter, setFilter] = useState('');
  
  // --- ESTADO DE SECCIONES ---
  const [sections, setSections] = useState<any[]>([]);
  const [secFilter, setSecFilter] = useState('');
  const [newSec, setNewSec] = useState<{ crn: string; room: string }>({ crn: '', room: '' });
  
  // Estado temporal para editar bloques de tiempo (día, hora inicio, hora fin)
  const [newBlock, setNewBlock] = useState<{
    [crn: string]: { day: string; timeStart12: string; apStart: 'AM' | 'PM'; timeEnd12: string; apEnd: 'AM' | 'PM' }
  }>({});

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- EFECTO DE CARGA ---
  useEffect(() => {
    setForm(course);
    const raw = getSectionsForCourse(course.id) || [];
    const normalized = normalizeSections(raw);
    setSections(normalized);
    setBanner(null);
    setNewBlock({}); // Limpiar inputs temporales
  }, [course, getSectionsForCourse]);

  // --- FILTROS ---
  const filteredList = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return allCourses
      .filter(c => c.id !== form.id)
      .filter(c => c.id.toLowerCase().includes(f) || c.name.toLowerCase().includes(f));
  }, [allCourses, filter, form.id]);

  const filteredSections = useMemo(() => {
    const q = secFilter.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      (s.crn?.toLowerCase?.() || '').includes(q) ||
      (s.room?.toLowerCase?.() || '').includes(q)
    );
  }, [sections, secFilter]);

  // --- HANDLERS CURSO ---
  const handleText = (k: keyof Course) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
  };

  const handleNumber = (k: keyof Course) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value || 0);
    setForm({ ...form, [k]: isNaN(v) ? 0 : v });
  };

  const toggleInList = (key: 'prerequisites' | 'corequisites', id: string) => {
    const list = new Set(form[key] ?? []);
    if (list.has(id)) list.delete(id); else list.add(id);
    setForm({ ...form, [key]: Array.from(list) });
  };

  const handleSaveCourse = () => {
    onSave({
      ...form,
      prerequisites: Array.from(new Set(form.prerequisites ?? [])),
      corequisites: Array.from(new Set(form.corequisites ?? [])),
    });
    setBanner({ type: 'success', text: 'Curso actualizado correctamente.' });
  };

  // --- HANDLERS SECCIONES ---
  const addSection = () => {
    const crn = newSec.crn.trim();
    if (!crn) return setBanner({ type: 'error', text: 'El CRN es obligatorio.' });
    if (sections.some(s => s.crn === crn)) return setBanner({ type: 'error', text: 'El CRN ya existe.' });

    const newEntry = { 
      crn, 
      room: newSec.room.trim(), 
      closed: false, 
      schedule: [] 
    };
    setSections(prev => [...prev, newEntry]);
    setNewSec({ crn: '', room: '' });
    setBanner({ type: 'success', text: 'Sección agregada.' });
  };

  const deleteSection = (crn: string) => {
    setSections(prev => prev.filter(s => s.crn !== crn));
  };

  const editSectionInline = (crn: string, field: string, value: any) => {
    setSections(prev => prev.map(s => s.crn === crn ? { ...s, [field]: value } : s));
  };

  // --- HANDLERS HORARIOS ---
  
  // Helper para inicializar el estado temporal de un bloque si no existe
  const initBlockState = (crn: string) => {
    if (!newBlock[crn]) {
      setNewBlock(prev => ({
        ...prev,
        [crn]: { day: 'Lunes', timeStart12: '07:00', apStart: 'AM', timeEnd12: '09:00', apEnd: 'AM' }
      }));
    }
  };

  const updateBlockState = (crn: string, field: string, value: any) => {
    initBlockState(crn);
    setNewBlock(prev => ({
      ...prev,
      [crn]: { ...prev[crn], [field]: value }
    }));
  };

  const addTimeBlock = (crn: string) => {
    const state = newBlock[crn] || { day: 'Lunes', timeStart12: '07:00', apStart: 'AM', timeEnd12: '09:00', apEnd: 'AM' };
    
    // Validar formato hh:mm simple
    if (!/^\d{1,2}:\d{2}$/.test(state.timeStart12) || !/^\d{1,2}:\d{2}$/.test(state.timeEnd12)) {
      return setBanner({type: 'error', text: 'Formato de hora inválido. Usa hh:mm'});
    }

    const start24 = to24h(state.timeStart12, state.apStart);
    const end24 = to24h(state.timeEnd12, state.apEnd);

    setSections(prev => prev.map(s => 
      s.crn === crn 
      ? { ...s, schedule: [...(s.schedule || []), { day: state.day, start: start24, end: end24 }] }
      : s
    ));
  };

  const removeTimeBlock = (crn: string, index: number) => {
    setSections(prev => prev.map(s => 
      s.crn === crn 
      ? { ...s, schedule: s.schedule.filter((_:any, i:number) => i !== index) }
      : s
    ));
  };

  const saveSections = async () => {
    // Validar conflictos internos
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        if (hasScheduleConflict(sections[i], sections[j])) {
          setBanner({ type: 'error', text: `Conflicto de horario entre ${sections[i].crn} y ${sections[j].crn}` });
          return;
        }
      }
    }

    const payload = denormalizeSections(sections);
    await setSectionsForCourse(form.id, payload);
    setBanner({ type: 'success', text: 'Horarios guardados exitosamente.' });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Curso: {form.id}</DialogTitle>
          <DialogDescription>Modifica los detalles del curso y sus horarios.</DialogDescription>
        </DialogHeader>

        {banner && (
          <div className={`p-3 rounded text-sm mb-2 ${banner.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {banner.text}
          </div>
        )}

        <Tabs defaultValue="data" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data">Información General</TabsTrigger>
            <TabsTrigger value="sections">Secciones y Horarios</TabsTrigger>
          </TabsList>

          {/* TAB 1: DATOS GENERALES */}
          <TabsContent value="data" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">ID Curso</label>
                <Input value={form.id} onChange={handleText('id')} disabled />
              </div>
              <div>
                <label className="text-xs font-medium">Nombre</label>
                <Input value={form.name} onChange={handleText('name')} />
              </div>
              <div>
                <label className="text-xs font-medium">Créditos</label>
                <Input type="number" value={form.credits} onChange={handleNumber('credits')} />
              </div>
              <div>
                <label className="text-xs font-medium">Cuatrimestre</label>
                <Input type="number" value={form.term} onChange={handleNumber('term')} />
              </div>
            </div>

            <Separator />
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="mb-2 text-sm font-medium">Prerrequisitos</div>
                <Input placeholder="Buscar..." value={filter} onChange={e => setFilter(e.target.value)} className="h-8 text-xs mb-2" />
                <div className="border rounded h-40 overflow-y-auto p-2 space-y-1">
                  {filteredList.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted p-1 rounded">
                      <input 
                        type="checkbox" 
                        checked={(form.prerequisites || []).includes(c.id)} 
                        onChange={() => toggleInList('prerequisites', c.id)}
                      />
                      <span className="font-bold">{c.id}</span>
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="mb-2 text-sm font-medium">Correquisitos</div>
                <div className="border rounded h-40 overflow-y-auto p-2 space-y-1 mt-10">
                  {filteredList.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted p-1 rounded">
                      <input 
                        type="checkbox" 
                        checked={(form.corequisites || []).includes(c.id)} 
                        onChange={() => toggleInList('corequisites', c.id)}
                      />
                      <span className="font-bold">{c.id}</span>
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveCourse}>Guardar Cambios del Curso</Button>
            </div>
          </TabsContent>

          {/* TAB 2: SECCIONES */}
          <TabsContent value="sections" className="space-y-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Input placeholder="Nueva Sección (CRN)" value={newSec.crn} onChange={e => setNewSec({...newSec, crn: e.target.value})} className="w-40" />
              <Input placeholder="Aula" value={newSec.room} onChange={e => setNewSec({...newSec, room: e.target.value})} className="w-24" />
              <Button onClick={addSection} size="sm" variant="secondary">Agregar</Button>
              <div className="flex-1" />
              <Input placeholder="Filtrar..." value={secFilter} onChange={e => setSecFilter(e.target.value)} className="w-40 h-9" />
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {filteredSections.map(section => (
                <div key={section.crn} className="border rounded-lg p-3 bg-card">
                  {/* Encabezado Sección */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">{section.crn}</span>
                      <Input 
                        value={section.room} 
                        onChange={e => editSectionInline(section.crn, 'room', e.target.value)} 
                        className="h-7 w-20 text-xs" 
                        placeholder="Aula"
                      />
                    </div>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => deleteSection(section.crn)}>
                      Eliminar Sección
                    </Button>
                  </div>

                  {/* Lista de Horarios */}
                  <div className="space-y-2 mb-3">
                    {section.schedule?.map((block: any, idx: number) => {
                      const start = to12h(block.start);
                      const end = to12h(block.end);
                      return (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-muted/30 p-1 rounded px-2">
                          <span className="font-medium w-20">{block.day}</span>
                          <span>{start.time} {start.ap}</span>
                          <span>-</span>
                          <span>{end.time} {end.ap}</span>
                          <div className="flex-1" />
                          <button onClick={() => removeTimeBlock(section.crn, idx)} className="text-red-500 hover:underline text-xs">Quitar</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Agregar Horario */}
                  <div className="flex items-center gap-2 bg-muted p-2 rounded text-sm">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Nuevo Horario:</span>
                    
                    <select 
                      className="h-8 border rounded text-xs bg-background"
                      value={newBlock[section.crn]?.day || 'Lunes'}
                      onChange={e => updateBlockState(section.crn, 'day', e.target.value)}
                    >
                      {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    {/* Inicio */}
                    <div className="flex items-center bg-background border rounded px-1">
                      <input 
                        className="w-10 h-8 text-xs text-center outline-none bg-transparent"
                        value={newBlock[section.crn]?.timeStart12 || '07:00'}
                        onChange={e => updateBlockState(section.crn, 'timeStart12', e.target.value)}
                        placeholder="07:00"
                      />
                      <select 
                        className="h-8 text-xs bg-transparent outline-none"
                        value={newBlock[section.crn]?.apStart || 'AM'}
                        onChange={e => updateBlockState(section.crn, 'apStart', e.target.value)}
                      >
                        <option>AM</option><option>PM</option>
                      </select>
                    </div>

                    <span>a</span>

                    {/* Fin */}
                    <div className="flex items-center bg-background border rounded px-1">
                      <input 
                        className="w-10 h-8 text-xs text-center outline-none bg-transparent"
                        value={newBlock[section.crn]?.timeEnd12 || '09:00'}
                        onChange={e => updateBlockState(section.crn, 'timeEnd12', e.target.value)}
                        placeholder="09:00"
                      />
                      <select 
                        className="h-8 text-xs bg-transparent outline-none"
                        value={newBlock[section.crn]?.apEnd || 'AM'}
                        onChange={e => updateBlockState(section.crn, 'apEnd', e.target.value)}
                      >
                        <option>AM</option><option>PM</option>
                      </select>
                    </div>

                    <Button size="sm" variant="outline" className="h-8 ml-auto" onClick={() => addTimeBlock(section.crn)}>
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t mt-4">
              <Button onClick={saveSections} className="w-full md:w-auto">Guardar Todos los Horarios</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}