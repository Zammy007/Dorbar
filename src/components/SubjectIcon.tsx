import {
  Atom,
  BookOpen,
  BookOpenText,
  Dna,
  Feather,
  FlaskConical,
  Globe2,
  Sigma,
} from 'lucide-react';

export function SubjectIcon({
  name,
  className = 'w-5 h-5',
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case 'BookOpenText':
      return <BookOpenText className={className} aria-hidden="true" />;
    case 'Feather':
      return <Feather className={className} aria-hidden="true" />;
    case 'Atom':
      return <Atom className={className} aria-hidden="true" />;
    case 'Sigma':
      return <Sigma className={className} aria-hidden="true" />;
    case 'FlaskConical':
      return <FlaskConical className={className} aria-hidden="true" />;
    case 'Dna':
      return <Dna className={className} aria-hidden="true" />;
    case 'Globe2':
      return <Globe2 className={className} aria-hidden="true" />;
    default:
      return <BookOpen className={className} aria-hidden="true" />;
  }
}
