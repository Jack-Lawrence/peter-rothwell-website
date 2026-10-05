// Structured data (JSON-LD) for search engines, built from the data files.
// Typed with schema-dts so a wrong property or type fails `astro check`.
import type { BlogPosting, Graph, Offer } from 'schema-dts';
import site from '../data/site.json';
import services from '../data/services.json';
import { absolute, telHref } from './url';

const businessId = absolute('/#business');
const personId = absolute('/#peter');
const instagram = `https://www.instagram.com/${site.contact.instagram}/`;
const shareImage = absolute('/og-default.png');

// "£80" → "80"; services without a price are left out of the offers.
const amount = (price: string) => price.replace(/[^0-9.]/g, '');

const offers: Offer[] = services
  .filter((s) => amount(s.price))
  .map((s) => ({
    '@type': 'Offer',
    url: absolute('/#coaching'),
    price: amount(s.price),
    priceCurrency: 'GBP',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: amount(s.price),
      priceCurrency: 'GBP',
      unitText: s.per.replace(/^\/\s*/, ''),
    },
    itemOffered: { '@type': 'Service', name: s.name, provider: { '@id': businessId } },
  }));

export function homeSchema(): Graph {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': businessId,
        name: site.name,
        description: site.description,
        url: absolute('/'),
        image: shareImage,
        logo: absolute('/icon-512.png'),
        telephone: telHref(site.contact.phone).replace('tel:', ''),
        email: site.contact.email,
        address: {
          '@type': 'PostalAddress',
          streetAddress: site.location.street,
          addressLocality: site.location.locality,
          postalCode: site.location.postcode,
          addressCountry: 'GB',
        },
        areaServed: site.location.locality,
        sameAs: [instagram],
        founder: { '@id': personId },
        makesOffer: offers,
      },
      {
        '@type': 'Person',
        '@id': personId,
        name: site.about.name,
        jobTitle: 'Running and strength coach',
        url: absolute('/#about'),
        worksFor: { '@id': businessId },
        sameAs: [instagram],
      },
    ],
  };
}

interface PostInfo {
  title: string;
  excerpt: string;
  date: Date;
  path: string;
  image?: string;
}

export function postSchema(post: PostInfo): BlogPosting & { '@context': string } {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date.toISOString(),
    url: absolute(post.path),
    mainEntityOfPage: absolute(post.path),
    image: post.image ?? shareImage,
    inLanguage: 'en-GB',
    author: { '@type': 'Person', '@id': personId, name: site.about.name, url: absolute('/#about') },
    publisher: { '@type': 'LocalBusiness', '@id': businessId, name: site.name, logo: absolute('/icon-512.png') },
  };
}
