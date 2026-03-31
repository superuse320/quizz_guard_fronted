import { configureStore } from '@reduxjs/toolkit';
import { formsApi } from './services/formsApi';
import { quizGeneratorApi } from './services/quizGeneratorApi';

export const store = configureStore({
  reducer: {
    [formsApi.reducerPath]: formsApi.reducer,
    [quizGeneratorApi.reducerPath]: quizGeneratorApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(formsApi.middleware, quizGeneratorApi.middleware),
});
