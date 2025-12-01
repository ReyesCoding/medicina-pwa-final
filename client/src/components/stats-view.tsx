import { useEffect, useState } from 'react';
import { useStudentProgress } from '@/contexts/student-progress-context';
import { Course } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, BookOpen, GraduationCap } from 'lucide-react';

export function StatsView() {
  const { passedCourses, calculateGPA } = useStudentProgress(); // Traemos calculateGPA
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

  if (loading) return <div className="p-8 text-center animate-pulse">Cargando estadísticas...</div>;

  const totalCourses = courses.length;
  const passedCount = passedCourses.size;
  const percentage = totalCourses > 0 ? Math.round((passedCount / totalCourses) * 100) : 0;

  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const passedCredits = courses
    .filter(c => passedCourses.has(c.id))
    .reduce((sum, c) => sum + (c.credits || 0), 0);
  
  const creditsPercentage = totalCredits > 0 ? Math.round((passedCredits / totalCredits) * 100) : 0;
  
  // CÁLCULO DEL GPA (ÍNDICE)
  const gpa = calculateGPA();
  
  // Determinamos el color del índice
  const getGpaColor = (val: number) => {
    if (val >= 3.5) return "text-emerald-500";
    if (val >= 3.0) return "text-blue-500";
    if (val >= 2.0) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Tu Progreso</h2>
          <p className="text-muted-foreground">Estadísticas en tiempo real de tu carrera.</p>
        </div>
      </div>

      {/* Grid de Tarjetas Principales */}
      <div className="grid gap-4 md:grid-cols-3">
        
        {/* TARJETA 1: MATERIAS */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Materias Aprobadas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {passedCount} <span className="text-muted-foreground text-lg font-normal">/ {totalCourses}</span>
            </div>
            <Progress value={percentage} className="h-2 mt-3" />
            <p className="text-xs text-muted-foreground mt-2">{percentage}% completado</p>
          </CardContent>
        </Card>

        {/* TARJETA 2: CRÉDITOS */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Acumulados</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {passedCredits} <span className="text-muted-foreground text-lg font-normal">/ {totalCredits}</span>
            </div>
            <Progress value={creditsPercentage} className="h-2 mt-3" />
            <p className="text-xs text-muted-foreground mt-2">{creditsPercentage}% de la carrera</p>
          </CardContent>
        </Card>

        {/* TARJETA 3: GPA / ÍNDICE (NUEVA) */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-primary">Índice Acumulado</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${getGpaColor(gpa)}`}>
              {gpa.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Escala de 0.0 a 4.0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}