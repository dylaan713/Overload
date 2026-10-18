import { createContext, useContext } from "react";
import { LIBRARY_VIEW_ID } from "./ids";

/** Where the add/create flows return to, and who hears about the exercise they added. */
export interface LibraryFlowValue {
  returnTo: string;
  onAdded?: (exerciseId: string) => void;
}

export const LibraryFlow = createContext<LibraryFlowValue>({ returnTo: LIBRARY_VIEW_ID });
export const useLibraryFlow = () => useContext(LibraryFlow);
