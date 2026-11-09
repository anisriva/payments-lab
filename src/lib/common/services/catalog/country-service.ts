import type { PrismaClient, Country, Market } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { CountryDAO } from '@/lib/common/dao/catalog/country-dao';
import { CountryNotFoundError } from './errors';

export class CountryService {
  private countryDAO: CountryDAO;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.countryDAO = new CountryDAO(prisma);
  }

  async listCountries(): Promise<Country[]> {
    const result = await this.countryDAO.listAll();
    return result.data;
  }

  /** Country by ISO-3166 alpha-2 code (e.g. 'IN'). */
  async getCountry(countryCode: string): Promise<Country> {
    const country = await this.countryDAO.findByCode(countryCode);
    if (!country) throw new CountryNotFoundError(countryCode);
    return country;
  }

  async getMarket(countryCode: string): Promise<Market> {
    const market = await this.countryDAO.marketForCountry(countryCode);
    if (!market) throw new CountryNotFoundError(countryCode);
    return market;
  }

  async listCurrencies(): Promise<string[]> {
    const countries = await this.listCountries();
    return [...new Set(countries.map((c) => c.currencyCode))].sort();
  }
}
