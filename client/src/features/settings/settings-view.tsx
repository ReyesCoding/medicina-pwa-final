import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { PENSUM } from '@/domain/curriculum';
import { toast } from '@/hooks/use-toast';
import { useStudent } from '@/state/app-state';
import { clearStudentData, parseBackup, serializeBackup, type StudentData } from '@/state/storage';

export function SettingsView() {
  const { data, dispatch, storageOk } = useStudent();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<StudentData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const recorded = Object.keys(data.history).length;

  const exportBackup = () => {
    const blob = new Blob([serializeBackup(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medicina-pwa-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    // Safari necesita que la URL siga viva un momento después del click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch (error) {
      toast({ title: 'No se pudo importar', description: (error as Error).message, variant: 'destructive' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {!storageOk && (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/20 p-3 text-sm">
          Tu navegador no está dejando guardar datos (puede ser el modo privado). Lo que hagas se perderá al cerrar: exportá un
          respaldo.
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold">Respaldo</h2>
        <p className="text-sm text-muted-foreground">
          Tus notas y tu plan se guardan sólo en este dispositivo. Exportá un respaldo de vez en cuando, y antes de cambiar de
          teléfono o borrar datos del navegador. Ahora tenés {recorded} materias con notas registradas.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="h-11" onClick={exportBackup}>
            <Download /> Exportar respaldo
          </Button>
          <Button variant="outline" className="h-11" onClick={() => fileInput.current?.click()}>
            <Upload /> Importar respaldo
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden
            onChange={(e) => void onFileChosen(e.target.files?.[0])}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
        <h2 className="text-lg font-semibold">Empezar de cero</h2>
        <p className="text-sm text-muted-foreground">Borra tus notas, lo que estás cursando y el plan. No se puede deshacer.</p>
        <Button variant="outline" className="h-11 border-destructive/60" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Borrar mis datos
        </Button>
      </section>

      <section className="space-y-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">Acerca de</h2>
        <p>
          {PENSUM.title} {PENSUM.university}, vigente desde {PENSUM.validFrom} (Resolución {PENSUM.resolution}),{' '}
          {PENSUM.totalCredits} créditos.
        </p>
        <p>
          <a
            href={`${import.meta.env.BASE_URL}docs/pensum-medicina-2013.pdf`}
            target="_blank"
            rel="noopener"
            className="font-medium text-primary underline underline-offset-4"
          >
            Ver el pensum oficial (PDF)
          </a>{' '}
          — de ahí salen las materias, requisitos y reglas de esta app.
        </p>
        <p>
          La oferta de secciones es una referencia importada del sistema de la universidad y puede cambiar. Confirmá siempre
          horarios y cupos en la selección oficial.
        </p>
        <p>
          Herramienta independiente, no oficial de UTESA. Sin cuentas ni servidores: nada sale de tu dispositivo. Versión{' '}
          {__APP_VERSION__}.
        </p>
      </section>

      <AlertDialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar tus datos con el respaldo?</AlertDialogTitle>
            <AlertDialogDescription>
              El respaldo tiene {Object.keys(pendingImport?.history ?? {}).length} materias con notas. Lo que tenés ahora en este
              dispositivo se reemplaza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                if (pendingImport) dispatch({ type: 'replace', data: pendingImport });
                toast({ title: 'Respaldo importado' });
              }}
            >
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar todos tus datos?</AlertDialogTitle>
            <AlertDialogDescription>Si no exportaste un respaldo, no hay forma de recuperarlos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                try {
                  clearStudentData(window.localStorage);
                } catch {
                  // Almacenamiento no disponible: el reset del estado igual deja la app vacía.
                }
                dispatch({ type: 'reset' });
                toast({ title: 'Datos borrados' });
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
