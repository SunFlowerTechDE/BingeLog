import Image from 'next/image';

/**
 * Der Verfasser eines Beitrags, dessen Konto gelöscht ist.
 *
 * Bewertung und Text bleiben stehen — beides ist eine Aussage über einen
 * Film, und der Film steht weiter da. Was geht, ist der Name: statt
 * seiner steht „Konto gelöscht", und es führt kein Link mehr irgendwohin.
 *
 * Das Symbol ist die **durchgestrichene** Silhouette, nicht der
 * Mülleimer. Ein Mülleimer neben einer Rezension hieße „dieser Beitrag
 * wurde gelöscht", und genau das stimmt hier nicht — der Beitrag steht,
 * das Konto ist weg.
 */
export function DeletedAccount({ size = 14 }: { size?: number }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
      <Image
        src="/icons/profile_delete.png"
        alt=""
        width={size}
        height={size}
        className="opacity-70"
        style={{ width: size, height: size }}
      />
      Konto gelöscht
    </span>
  );
}
