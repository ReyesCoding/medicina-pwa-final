// client/src/data-access/provider.ts
import type { DataProvider } from './DataProvider';
import { LocalJsonProvider } from './LocalJsonProvider'; // <- named import

const provider: DataProvider = new LocalJsonProvider();
export default provider;
