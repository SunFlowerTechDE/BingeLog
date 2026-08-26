/**
 * The cases the roadmap names by hand, plus enough ordinary films that a
 * contact sheet shows whether the palette repeats visibly (M2 2.1).
 */
import type { PosterInput } from '../src/render.ts';

/** The hard cases, called out explicitly in M2 2.1. */
export const HARD_CASES: PosterInput[] = [
  {
    wikidataId: 'Q152825',
    title: 'Jeder für sich und Gott gegen alle',
    releaseYear: 1974,
    director: 'Werner Herzog',
  },
  {
    wikidataId: 'Q-long-es',
    title: 'Orgullo, Pasión, y Gloria: Tres Noches en la Ciudad de México',
    releaseYear: 2009,
    director: 'Michael Jackson',
  },
  { wikidataId: 'Q48765577', title: '万引き家族', releaseYear: 2018, director: '是枝裕和' },
  { wikidataId: 'Q125772', title: 'Солярис', releaseYear: 1972, director: 'Андрей Тарковский' },
];

const ORDINARY: PosterInput[] = [
  { wikidataId: 'Q156911', title: 'Der Himmel über Berlin', releaseYear: 1987, director: 'Wim Wenders' },
  { wikidataId: 'Q271830', title: 'Der dritte Mann', releaseYear: 1949, director: 'Carol Reed' },
  { wikidataId: 'Q-wand', title: 'Die Wand', releaseYear: 2012, director: 'Julian Rosefeldt' },
  { wikidataId: 'Q-amrum', title: 'Amrum', releaseYear: 2025, director: 'Fatih Akın' },
  { wikidataId: 'Q-manitu', title: 'Das Kanu des Manitu', releaseYear: 2025, director: 'Michael Bully Herbig' },
  { wikidataId: 'Q-m', title: 'M', releaseYear: 1931, director: 'Fritz Lang' },
  { wikidataId: 'Q-metropolis', title: 'Metropolis', releaseYear: 1927, director: 'Fritz Lang' },
  { wikidataId: 'Q-angst', title: 'Angst essen Seele auf', releaseYear: 1974, director: 'Rainer Werner Fassbinder' },
  { wikidataId: 'Q-lola', title: 'Lola rennt', releaseYear: 1998, director: 'Tom Tykwer' },
  { wikidataId: 'Q-blech', title: 'Die Blechtrommel', releaseYear: 1979, director: 'Volker Schlöndorff' },
  { wikidataId: 'Q-leben', title: 'Das Leben der Anderen', releaseYear: 2006, director: 'Florian Henckel von Donnersmarck' },
  { wikidataId: 'Q-toni', title: 'Toni Erdmann', releaseYear: 2016, director: 'Maren Ade' },
  { wikidataId: 'Q-aguirre', title: 'Aguirre, der Zorn Gottes', releaseYear: 1972, director: 'Werner Herzog' },
  { wikidataId: 'Q-fitz', title: 'Fitzcarraldo', releaseYear: 1982, director: 'Werner Herzog' },
  { wikidataId: 'Q-paris', title: 'Paris, Texas', releaseYear: 1984, director: 'Wim Wenders' },
  { wikidataId: 'Q-alice', title: 'Alice in den Städten', releaseYear: 1974, director: 'Wim Wenders' },
  { wikidataId: 'Q-stalker', title: 'Сталкер', releaseYear: 1979, director: 'Андрей Тарковский' },
  { wikidataId: 'Q-rashomon', title: '羅生門', releaseYear: 1950, director: '黒澤明' },
  { wikidataId: 'Q-tokyo', title: '東京物語', releaseYear: 1953, director: '小津安二郎' },
  { wikidataId: 'Q-parasite', title: '기생충', releaseYear: 2019, director: '봉준호' },
  { wikidataId: 'Q-8andahalf', title: 'Otto e mezzo', releaseYear: 1963, director: 'Federico Fellini' },
  { wikidataId: 'Q-ladri', title: 'Ladri di biciclette', releaseYear: 1948, director: 'Vittorio De Sica' },
  { wikidataId: 'Q-hiroshima', title: 'Hiroshima mon amour', releaseYear: 1959, director: 'Alain Resnais' },
  { wikidataId: 'Q-bout', title: 'À bout de souffle', releaseYear: 1960, director: 'Jean-Luc Godard' },
  { wikidataId: 'Q-jules', title: 'Jules et Jim', releaseYear: 1962, director: 'François Truffaut' },
  { wikidataId: 'Q-persona', title: 'Persona', releaseYear: 1966, director: 'Ingmar Bergman' },
  { wikidataId: 'Q-siebente', title: 'Det sjunde inseglet', releaseYear: 1957, director: 'Ingmar Bergman' },
  { wikidataId: 'Q-nostalghia', title: 'Nostalghia', releaseYear: 1983, director: 'Андрей Тарковский' },
  { wikidataId: 'Q-satantango', title: 'Sátántangó', releaseYear: 1994, director: 'Béla Tarr' },
  { wikidataId: 'Q-stellet', title: 'Stellet Licht', releaseYear: 2007, director: 'Carlos Reygadas' },
  { wikidataId: 'Q-uncle', title: 'ลุงบุญมีระลึกชาติ', releaseYear: 2010, director: 'Apichatpong Weerasethakul' },
  { wikidataId: 'Q-cache', title: 'Caché', releaseYear: 2005, director: 'Michael Haneke' },
  { wikidataId: 'Q-liebe', title: 'Liebe', releaseYear: 2012, director: 'Michael Haneke' },
  { wikidataId: 'Q-band', title: 'Das weiße Band', releaseYear: 2009, director: 'Michael Haneke' },
  { wikidataId: 'Q-melancholia', title: 'Melancholia', releaseYear: 2011, director: 'Lars von Trier' },
  { wikidataId: 'Q-dogville', title: 'Dogville', releaseYear: 2003, director: 'Lars von Trier' },
  { wikidataId: 'Q-nymph', title: 'Nymphomaniac', releaseYear: 2013, director: 'Lars von Trier' },
  { wikidataId: 'Q-shoplift', title: 'Shoplifters – Familienbande', releaseYear: 2018, director: 'Hirokazu Kore-eda' },
  { wikidataId: 'Q-drive', title: 'Drive My Car', releaseYear: 2021, director: 'Ryūsuke Hamaguchi' },
  { wikidataId: 'Q-burning', title: '버닝', releaseYear: 2018, director: '이창동' },
  { wikidataId: 'Q-roma', title: 'Roma', releaseYear: 2018, director: 'Alfonso Cuarón' },
  { wikidataId: 'Q-zama', title: 'Zama', releaseYear: 2017, director: 'Lucrecia Martel' },
  { wikidataId: 'Q-tabu', title: 'Tabu', releaseYear: 2012, director: 'Miguel Gomes' },
  { wikidataId: 'Q-arabian', title: 'As Mil e Uma Noites', releaseYear: 2015, director: 'Miguel Gomes' },
  { wikidataId: 'Q-ida', title: 'Ida', releaseYear: 2013, director: 'Paweł Pawlikowski' },
  { wikidataId: 'Q-cold', title: 'Zimna wojna', releaseYear: 2018, director: 'Paweł Pawlikowski' },
];

export const SAMPLE_FILMS: PosterInput[] = [...HARD_CASES, ...ORDINARY];
