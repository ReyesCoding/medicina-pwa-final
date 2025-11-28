import { useEffect, useState } from 'react';
import { useStudentProgress } from '@/contexts/student-progress-context';
import { Course } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function StatsView() {
  // TypeScript detectó que passedCourses es un Set<string>
  const { passedCourses } = useStudentProgress();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('data/courses.json')
      .then(res => res.json())
      .then(data => {
        setCourses(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading courses:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Cargando estadísticas...</div>;

  const totalCourses = courses.length;
  
  // CORRECCIÓN TYPESCRIPT: Los Sets usan .size, no .length
  const passedCount = passedCourses.size; 
  
  const percentage = totalCourses > 0 ? Math.round((passedCount / totalCourses) * 100) : 0;

  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  
  // CORRECCIÓN TYPESCRIPT: Los Sets usan .has(), no .includes()
  const passedCredits = courses
    .filter(c => passedCourses.has(c.id)) 
    .reduce((sum, c) => sum + (c.credits || 0), 0);
  
  const creditsPercentage = totalCredits > 0 ? Math.round((passedCredits / totalCredits) * 100) : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Tu Progreso</h2>
        <p className="text-muted-foreground">Resumen detallado de tu avance en la carrera.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Materias Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4">
              {passedCount} <span className="text-muted-foreground text-xl font-normal">/ {totalCourses}</span>
            </div>
            <Progress value={percentage} className="h-3 mb-2" />
            <p className="text-xs text-muted-foreground text-right">{percentage}% completado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Acumulados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4">
              {passedCredits} <span className="text-muted-foreground text-xl font-normal">/ {totalCredits}</span>
            </div>
            <Progress value={creditsPercentage} className="h-3 mb-2" />
            <p className="text-xs text-muted-foreground text-right">{creditsPercentage}% completado</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}