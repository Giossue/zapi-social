import {
  fileLibraryFixture,
  onlineMediaSearchFixture,
} from "@/features/files/fixtures/files"
import type {
  FileLibraryData,
  OnlineMediaSearchData,
} from "@/features/files/types/files"

export async function getFileLibraryMock(): Promise<FileLibraryData> {
  return fileLibraryFixture
}

export async function getOnlineMediaSearchMock(): Promise<OnlineMediaSearchData> {
  return onlineMediaSearchFixture
}
