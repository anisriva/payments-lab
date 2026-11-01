import type { PrismaClient, Country } from '@/generated/prisma';
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

  async getCountry(code: string): Promise<Country> {
    const country = await this.countryDAO.findByCode(code);
    if (!country) throw new CountryNotFoundError(code);
    return country;
  }

  async listCurrencies(): Promise<string[]> {
    const countries = await this.listCountries();
    return [...new Set(countries.map((c) => c.currencyCode))].sort();
  }
}
