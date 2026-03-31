import { configureStore } from '@reduxjs/toolkit';
import { formsApi } from './services/formsApi';
import { quizGeneratorApi } from './services/quizGeneratorApi';
import homeUiReducer from './slices/homeUiSlice';

export const store = configureStore({
  reducer: {
    homeUi: homeUiReducer,
    [formsApi.reducerPath]: formsApi.reducer,
    [quizGeneratorApi.reducerPath]: quizGeneratorApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(formsApi.middleware, quizGeneratorApi.middleware),
});
