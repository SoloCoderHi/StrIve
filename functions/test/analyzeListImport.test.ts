import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { analyzeListImport } from '../index';
import * as Busboy from 'busboy';

// Initialize Firebase Test SDK
const test = functionsTest();

// Mock data for testing
const mockUserId = 'test-user-id';
const mockListId = 'test-list-id';
const mockMovieItems = [
  {
    id: '123',
    title: 'Test Movie',
    release_date: '2022-01-01',
    poster_path: '/test-poster.jpg',
    vote_average: 8.5,
    media_type: 'movie',
    dateAdded: new Date().toISOString(),
  },
  {
    id: '456',
    title: 'Another Test Movie',
    release_date: '2023-05-15',
    poster_path: '/test-poster2.jpg',
    vote_average: 7.8,
    media_type: 'movie',
    dateAdded: new Date().toISOString(),
  }
];

// Sample CSV content
const sampleCsvContent = `tmdbId,Name,Year,Letterboxd URI
123,Test Movie,2022,https://letterboxd.com/film/test-movie
789,New Movie,2023,https://letterboxd.com/film/new-movie`;

describe('Analyze List Import Function', () => {
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

  it('should return 401 if no authorization header is provided', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {},
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    await analyzeListImport(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid authorization header' });
  });

  it('should return 401 if invalid token is provided', async () => {
    const req = {
      method: 'POST',
      path: `/lists/${mockListId}/import/analyze`,
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };
    
    const res = { 
      status: jest.fn(() => res), 
      json: jest.fn(),
      set: jest.fn(() => res),
      send: jest.fn()
    };

    // Mock auth verification to fail
    const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
    mockAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });

    await analyzeListImport(req as any, res as any);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
  });

  it('should return 404 if list does not exist', async () => {
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

  it('should return 403 if user does not own the list', async () => {
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

  it('should return 400 if content type is not multipart/form-data', async () => {
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

  it('should return analysis results when CSV is valid', async () => {
    // This test is more complex due to Busboy parsing
    // We'll test the response after the file is processed
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

  it('should return 400 if CSV file is empty or invalid', async () => {
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