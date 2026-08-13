/**
 * Constantes partagees entre le serveur et le client.
 *
 * Ce module ne porte volontairement ni "use client" ni "use server" : une
 * valeur exportee depuis un module client devient, vue du serveur, une
 * reference vers le client et non la valeur elle-meme.
 */

/** Au-dela, le guichet prend le relais. C'est aussi un garde-fou anti-robot. */
export const MAX_SEATS_PER_BOOKING = 10;
