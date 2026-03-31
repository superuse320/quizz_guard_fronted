import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const quizGeneratorApi = createApi({
  reducerPath: 'quizGeneratorApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://quizzia-backend-sgziwn-2de2b7-107-148-105-38.traefik.me',
  }),
  endpoints: (builder) => ({
    generateQuiz: builder.mutation({
      query: ({ prompt, accessToken }) => ({
        url: '/api/quiz/generate',
        method: 'POST',
        headers: {
          accept: '*/*',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: { tema: prompt },
      }),
    }),
    regenerateQuestion: builder.mutation({
      query: ({ accessToken, ...payload }) => ({
        url: '/api/quiz/regenerate-question',
        method: 'POST',
        headers: {
          accept: '*/*',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
        body: payload,
      }),
    }),
  }),
})

export const { useGenerateQuizMutation, useRegenerateQuestionMutation } = quizGeneratorApi
