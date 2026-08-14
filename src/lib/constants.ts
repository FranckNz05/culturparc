/**
 * Constantes partagees entre le serveur et le client.
 *
 * Ce module ne porte volontairement ni "use client" ni "use server" : une
 * valeur exportee depuis un module client devient, vue du serveur, une
 * reference vers le client et non la valeur elle-meme.
 */

/** Au-dela, le guichet prend le relais. C'est aussi un garde-fou anti-robot. */
export const MAX_SEATS_PER_BOOKING = 10;

/**
 * Longueur minimale d'un mot de passe du personnel.
 *
 * Douze caracteres plutot que huit : ces comptes ouvrent la caisse, la
 * programmation et le controle d'acces, et le mot de passe initial est
 * communique de vive voix, donc souvent simple.
 */
export const MIN_PASSWORD_LENGTH = 12;
