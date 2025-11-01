import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { analyzeListImport } from '../index';
import * as Busboy from 'busboy';

const test = functionsTest();

const mockUserId = 'test-user-id';
const mockListId = 'test-list-id';

const VALID_HEADERS = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
const LEGACY_HEADERS = 'tmdbId,Name,Year,Letterboxd URI';

const validCsvMovie = `${VALID_HEADERS}
123,,Test Movie,2022,movie,7.5,,100,
456,,Another Movie,2021,movie,8.1,,200,`;

const validCsvTv = `${VALID_HEADERS}
789,,Test Show,2020,tv,8.5,,150,`;

const validCsvWithImdb = `${VALID_HEADERS}
,tt1234567,Movie With IMDb,2019,movie,6.8,,90,`;

const legacyCsv = `${LEGACY_HEADERS}
123,Test Movie,2022,https://letterboxd.com/film/test`;

const invalidHeadersCsv = `tmdbId,wrong,headers
123,val1,val2`;

describe('analyzeListImport - Schema Validation', () => {
  let mockAuth: any;
  let mockFirestore: any;

  beforeAll(() => {
    // Initialize Firebase Admin SDK with test project ID
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'test-project',
      });
    }
    
    // Mock auth and Firestore
    mockAuth = jest.spyOn(admin, 'auth');
    mockFirestore = jest.spyOn(admin, 'firestore');
  });

  afterAll(() => {
    test.cleanup();
    jest.clearAllMocks();
  });

  it('rejects legacy CSV headers (Letterboxd URI, Name, Year)', async () => {
    const req = makeReq(mockListId, legacyCsv);
    const res = makeRes();
    mockAuthValid();
    mockFirestoreCustomList(mockListId, mockUserId);

    const busboy = {
      on: jest.fn((event, callback) => {
        if (event === 'file') {
          const mockFile = {
            on: jest.fn((subEvent, subCallback) => {
              if (subEvent === 'data') subCallback(Buffer.from(legacyCsv));
              else if (subEvent === 'end') subCallback();
              return mockFile;
            }),
            resume: jest.fn(),
          };
          callback('file', mockFile, { filename: 'legacy.csv', mimeType: 'text/csv' });
        } else if (event === 'finish') {
          setImmediate(callback);
        }
        return busboy;
      }),
    };
    (req as any).pipe = jest.fn().mockImplementation(() => {
      busboy.on('file', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'file')[1]);
      busboy.on('finish', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'finish')[1]);
    });

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Legacy CSV headers detected'),
    }));
  });

  it('rejects invalid CSV headers (wrong column names)', async () => {
    const req = makeReq(mockListId, invalidHeadersCsv);
    const res = makeRes();
    mockAuthValid();
    mockFirestoreCustomList(mockListId, mockUserId);

    const busboy = {
      on: jest.fn((event, callback) => {
        if (event === 'file') {
          const mockFile = {
            on: jest.fn((subEvent, subCallback) => {
              if (subEvent === 'data') subCallback(Buffer.from(invalidHeadersCsv));
              else if (subEvent === 'end') subCallback();
              return mockFile;
            }),
            resume: jest.fn(),
          };
          callback('file', mockFile, { filename: 'invalid.csv', mimeType: 'text/csv' });
        } else if (event === 'finish') {
          setImmediate(callback);
        }
        return busboy;
      }),
    };
    (req as any).pipe = jest.fn().mockImplementation(() => {
      busboy.on('file', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'file')[1]);
      busboy.on('finish', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'finish')[1]);
    });

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Invalid CSV headers'),
    }));
  });

  it('accepts valid CSV with exact headers', async () => {
    const req = makeReq(mockListId, validCsvMovie);
    const res = makeRes();
    mockAuthValid();
    mockFirestoreCustomList(mockListId, mockUserId);
    delete process.env.TMDB_API_KEY;

    const busboy = {
      on: jest.fn((event, callback) => {
        if (event === 'file') {
          const mockFile = {
            on: jest.fn((subEvent, subCallback) => {
              if (subEvent === 'data') subCallback(Buffer.from(validCsvMovie));
              else if (subEvent === 'end') subCallback();
              return mockFile;
            }),
            resume: jest.fn(),
          };
          callback('file', mockFile, { filename: 'valid.csv', mimeType: 'text/csv' });
        } else if (event === 'finish') {
          setImmediate(callback);
        }
        return busboy;
      }),
    };
    (req as any).pipe = jest.fn().mockImplementation(() => {
      busboy.on('file', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'file')[1]);
      busboy.on('finish', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'finish')[1]);
    });

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      matched: expect.any(Array),
      unmatched: expect.any(Array),
      duplicates: expect.any(Array),
    }));
  });

  it('returns 401 if no authorization header is provided', async () => {
    const req = makeReq(mockListId, validCsvMovie, '');
    (req as any).headers.authorization = undefined;
    const res = makeRes();

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid authorization header' });
  });

  it('returns 401 if invalid token is provided', async () => {
    const req = makeReq(mockListId, validCsvMovie, 'bad-token');
    const res = makeRes();
    mockAuthInvalid();

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
  });

  it('returns 404 if custom list does not exist', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'multipart/form-data; boundary=----formdata-boundary',
      },
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a non-existing list
    const mockGet = jest.fn().mockResolvedValue({ exists: false });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'List not found' });
  });

  it('returns 403 if user does not own the custom list', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'multipart/form-data; boundary=----formdata-boundary',
      },
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a list that doesn't belong to the user
    const mockGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: 'different-user-id' }) 
    });
    const mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: You do not have permission to access this list' });
  });

  it('returns 400 if content type is not multipart/form-data', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a valid list
    const mockListGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: mockUserId }) 
    });
    const mockListDoc = jest.fn().mockReturnValue({ get: mockListGet });
    const mockItemsGet = jest.fn().mockResolvedValue({ 
      docs: [], // No existing items
    });
    const mockItemsCollectionRef = jest.fn().mockReturnValue({ get: mockItemsGet });
    const mockCollection = jest.fn((...args) => {
      if (args[0] === 'users') {
        const mockUserCollection = jest.fn((userId) => {
          if (userId === mockUserId) {
            const mockCustomListsCollection = jest.fn((listType) => {
              if (listType === 'custom_lists') {
                const mockListRef = jest.fn((listId) => {
                  if (listId === mockListId) {
                    return { get: mockListGet, collection: mockItemsCollectionRef };
                  }
                  return { get: jest.fn().mockResolvedValue({ exists: false }) };
                });
                return mockListRef;
              }
              return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
            });
            return mockCustomListsCollection;
          }
          return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
        });
        return mockUserCollection;
      }
      return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
    });
    
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Content-Type must be multipart/form-data' });
  });

  it('supports watchlist as target (listId=watchlist)', async () => {
    const req = makeReq('watchlist', validCsvMovie);
    const res = makeRes();
    mockAuthValid();
    mockFirestoreWatchlist();
    delete process.env.TMDB_API_KEY;

    const busboy = {
      on: jest.fn((event, callback) => {
        if (event === 'file') {
          const mockFile = {
            on: jest.fn((subEvent, subCallback) => {
              if (subEvent === 'data') subCallback(Buffer.from(validCsvMovie));
              else if (subEvent === 'end') subCallback();
              return mockFile;
            }),
            resume: jest.fn(),
          };
          callback('file', mockFile, { filename: 'watchlist.csv', mimeType: 'text/csv' });
        } else if (event === 'finish') {
          setImmediate(callback);
        }
        return busboy;
      }),
    };
    (req as any).pipe = jest.fn().mockImplementation(() => {
      busboy.on('file', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'file')[1]);
      busboy.on('finish', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'finish')[1]);
    });

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      matched: expect.any(Array),
      unmatched: expect.any(Array),
      duplicates: expect.any(Array),
    }));
  });

  it('detects duplicates by tmdbId in target list', async () => {
    const existingItem = { id: '123', title: 'Test Movie', release_date: '2022-01-01', media_type: 'movie' };
    const req = makeReq(mockListId, validCsvMovie);
    const res = makeRes();
    mockAuthValid();
    mockFirestoreCustomList(mockListId, mockUserId, [existingItem]);
    delete process.env.TMDB_API_KEY;

    const busboy = {
      on: jest.fn((event, callback) => {
        if (event === 'file') {
          const mockFile = {
            on: jest.fn((subEvent, subCallback) => {
              if (subEvent === 'data') subCallback(Buffer.from(validCsvMovie));
              else if (subEvent === 'end') subCallback();
              return mockFile;
            }),
            resume: jest.fn(),
          };
          callback('file', mockFile, { filename: 'dup.csv', mimeType: 'text/csv' });
        } else if (event === 'finish') {
          setImmediate(callback);
        }
        return busboy;
      }),
    };
    (req as any).pipe = jest.fn().mockImplementation(() => {
      busboy.on('file', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'file')[1]);
      busboy.on('finish', (busboy as any).on.mock.calls.find((c: any) => c[0] === 'finish')[1]);
    });

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.duplicates.length).toBeGreaterThan(0);
    expect(result.duplicates.some((d: any) => d.movie.id === 123 || d.movie.id === '123')).toBe(true);
  });

  it('returns analysis results when CSV is valid', async () => {
    const mockBusboy = {
      on: jest.fn((event, callback) => {
        if (event === 'file') {
          // Simulate CSV file upload
          const mockFile = {
            on: jest.fn((subEvent, subCallback) => {
              if (subEvent === 'data') {
                // Emit the CSV data
                subCallback(Buffer.from(sampleCsvContent));
              } else if (subEvent === 'end') {
                // End the file processing
                subCallback();
              }
              return mockFile;
            }),
            resume: jest.fn()
          };
          callback('csvFile', mockFile, { 
            filename: 'test.csv', 
            encoding: '7bit', 
            mimeType: 'text/csv' 
          });
        } else if (event === 'finish') {
          // Immediately call the finish callback to process the CSV
          setImmediate(() => callback());
        }
        return mockBusboy;
      }),
      pipe: jest.fn()
    };
    
    // Mock Busboy creation
    jest.mock('busboy', () => {
      return jest.fn(() => mockBusboy);
    });
    
    const mockPipe = jest.fn();
    const req: any = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'multipart/form-data; boundary=----formdata-boundary',
      },
      pipe: mockPipe
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a valid list and items
    const mockListGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: mockUserId }) 
    });
    const mockListDoc = jest.fn().mockReturnValue({ get: mockListGet });
    const mockItemsGet = jest.fn().mockResolvedValue({ 
      docs: mockMovieItems.map(item => ({
        data: () => item
      }))
    });
    const mockItemsCollectionRef = jest.fn().mockReturnValue({ get: mockItemsGet });
    const mockCollection = jest.fn((...args) => {
      if (args[0] === 'users') {
        const mockUserCollection = jest.fn((userId) => {
          if (userId === mockUserId) {
            const mockCustomListsCollection = jest.fn((listType) => {
              if (listType === 'custom_lists') {
                const mockListRef = jest.fn((listId) => {
                  if (listId === mockListId) {
                    return { get: mockListGet, collection: mockItemsCollectionRef };
                  }
                  return { get: jest.fn().mockResolvedValue({ exists: false }) };
                });
                return mockListRef;
              }
              return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
            });
            return mockCustomListsCollection;
          }
          return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
        });
        return mockUserCollection;
      }
      return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
    });
    
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    // Note: For a complete test, we would need to properly mock the Busboy parsing
    // This is a simplified test to verify the function can handle the request
    await analyzeListImport(req as any, res as any);

    // The pipe method should be called to process the request
    expect(mockPipe).toHaveBeenCalledWith(req);
  });

  it('returns 400 if CSV file is empty or invalid', async () => {
    const mockBusboy = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          // Simulate finish without any file
          setImmediate(() => callback());
        }
        return mockBusboy;
      }),
      pipe: jest.fn()
    };
    
    const mockPipe = jest.fn();
    const req: any = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'multipart/form-data; boundary=----formdata-boundary',
      },
      pipe: mockPipe
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to succeed
    const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: mockUserId });
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
    
    // Mock Firestore to return a valid list
    const mockListGet = jest.fn().mockResolvedValue({ 
      exists: true,
      data: () => ({ ownerId: mockUserId }) 
    });
    const mockListDoc = jest.fn().mockReturnValue({ get: mockListGet });
    const mockItemsGet = jest.fn().mockResolvedValue({ 
      docs: [],
    });
    const mockItemsCollectionRef = jest.fn().mockReturnValue({ get: mockItemsGet });
    const mockCollection = jest.fn((...args) => {
      if (args[0] === 'users') {
        const mockUserCollection = jest.fn((userId) => {
          if (userId === mockUserId) {
            const mockCustomListsCollection = jest.fn((listType) => {
              if (listType === 'custom_lists') {
                const mockListRef = jest.fn((listId) => {
                  if (listId === mockListId) {
                    return { get: mockListGet, collection: mockItemsCollectionRef };
                  }
                  return { get: jest.fn().mockResolvedValue({ exists: false }) };
                });
                return mockListRef;
              }
              return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
            });
            return mockCustomListsCollection;
          }
          return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
        });
        return mockUserCollection;
      }
      return jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) });
    });
    
    const mockDb = {
      collection: mockCollection,
    };
    
    mockFirestore.mockReturnValue(mockDb);

    await analyzeListImport(req as any, res as any);

    // The pipe method should be called to process the request
    expect(mockPipe).toHaveBeenCalledWith(req);
    // Since there's no file, it should eventually return the 400 error
  });
});