import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  lessonAiDocumentDtoSchema,
  lessonAiJobDtoSchema,
  lessonDtoSchema,
  quizDtoSchema,
} from '../../contracts/dist/index.js';
import {
  call,
  config,
  createPublishedCourse,
  expectData,
  expectError,
  loginAdmin,
  loginInstructor,
  registerStudent,
  unique,
  uploadMedia,
  waitUntil,
} from './support/api.mjs';

const providerStatsUrl = process.env.REGRESSION_AI_PROVIDER_STATS_URL ?? '';

test(
  'ai-lesson: cấu hình provider, trích xuất tài liệu, AI soạn bài và sinh quiz',
  { skip: config.aiProviderUrl ? false : 'thiếu REGRESSION_AI_PROVIDER_URL (provider AI giả)' },
  async (t) => {
    const admin = await loginAdmin();
    const instructor = await loginInstructor();
    const student = await registerStudent('ai');
    const apiKey = `sk-regression-${unique('key')}`;
    const lessonPath = (courseId, lessonId) => `/api/v1/courses/${courseId}/lessons/${lessonId}`;

    await t.test('admin cấu hình provider, model, gán task; API key không bao giờ lộ', async () => {
      expectError(
        await call('POST', '/api/v1/ai/providers', {
          token: instructor.token,
          body: {
            name: 'x',
            provider_type: 'CUSTOM',
            base_url: config.aiProviderUrl,
            api_key: apiKey,
          },
        }),
        403,
      );
      const created = await call('POST', '/api/v1/ai/providers', {
        token: admin.token,
        body: {
          name: unique('Provider giả'),
          provider_type: 'CUSTOM',
          base_url: config.aiProviderUrl,
          api_key: apiKey,
        },
      });
      const provider = expectData(created, 201, undefined, 'tạo provider');
      assert.equal(
        JSON.stringify(created.body).includes(apiKey),
        false,
        'response không chứa API key',
      );
      assert.ok(provider.api_key_hint);

      const model = expectData(
        await call('POST', '/api/v1/ai/models', {
          token: admin.token,
          body: {
            provider_id: provider.id,
            model_name: unique('model'),
            display_name: 'Model giả',
          },
        }),
        201,
        undefined,
        'tạo model',
      );
      for (const task of ['document-extraction', 'lesson-synthesis', 'quiz-authoring']) {
        const bound = await call('PUT', `/api/v1/ai/service-bindings/${task}`, {
          token: admin.token,
          body: { model_id: model.id },
        });
        assert.ok(
          [200, 201].includes(bound.status),
          `gán task ${task}: ${bound.status} ${JSON.stringify(bound.body)}`,
        );
      }

      const health = await call('POST', `/api/v1/ai/providers/${provider.id}/health-check`, {
        token: admin.token,
      });
      assert.equal(expectData(health, 200).health_status, 'ONLINE');
    });

    const { courseId, lessons } = await createPublishedCourse(instructor.token);
    const lessonId = lessons[0].id;
    let mediaId;

    await t.test('đính kèm tệp TXT với extract_text → ai-worker trích xuất EXTRACTED', async () => {
      const text = Buffer.from('Quy hoạch động chia bài toán lớn thành các bài toán con gối nhau.');
      const upload = await uploadMedia(instructor.token, text, 'ghi-chu.txt', 'text/plain', {
        extractText: true,
      });
      mediaId = upload.mediaId;
      assert.equal(upload.complete.status, 200, JSON.stringify(upload.complete.body));

      const attached = await call('POST', '/api/v1/media/usages', {
        token: instructor.token,
        body: {
          media_id: mediaId,
          owner_kind: 'COURSE',
          owner_id: lessonId,
          usage_type: 'LESSON_ATTACHMENT',
        },
      });
      assert.equal(attached.status, 201, JSON.stringify(attached.body));

      const synced = await call('POST', `${lessonPath(courseId, lessonId)}/ai-documents/sync`, {
        token: instructor.token,
      });
      assert.ok(synced.status < 300, `sync trả ${synced.status}`);

      const documents = await waitUntil('tài liệu EXTRACTED', async () => {
        const listed = await call('GET', `${lessonPath(courseId, lessonId)}/ai-documents`, {
          token: instructor.token,
        });
        const items = expectData(listed, 200);
        const document = items.find((item) => item.media_id === mediaId);
        if (document?.status === 'FAILED')
          throw new Error(`trích xuất FAILED: ${document.error_code}`);
        return document?.status === 'EXTRACTED' ? document : null;
      });
      lessonAiDocumentDtoSchema.parse(documents);
      assert.ok(documents.text_length > 0);
      assert.equal(
        JSON.stringify(documents).includes('Quy hoạch'),
        false,
        'không trả văn bản đã trích xuất',
      );
    });

    await t.test(
      'SYNTHESIZE_LESSON: cần overwrite_content khi bài đã có nội dung, rồi ghi qua course',
      async () => {
        const jobsPath = `${lessonPath(courseId, lessonId)}/ai-jobs`;
        const blocked = await call('POST', jobsPath, {
          token: instructor.token,
          body: { job_type: 'SYNTHESIZE_LESSON', media_ids: [mediaId] },
        });
        expectError(blocked, 409, 'LESSON_CONTENT_EXISTS');

        const created = await call('POST', jobsPath, {
          token: instructor.token,
          body: { job_type: 'SYNTHESIZE_LESSON', media_ids: [mediaId], overwrite_content: true },
        });
        assert.equal(created.status, 202, JSON.stringify(created.body));
        const jobId = expectData(created, 202, lessonAiJobDtoSchema).id;
        const done = await waitUntil('job soạn bài COMPLETED', async () => {
          const job = expectData(
            await call('GET', `${jobsPath}/${jobId}`, { token: instructor.token }),
            200,
          ).job;
          if (job.status === 'FAILED')
            throw new Error(`job FAILED: ${job.error_code} ${job.error_message}`);
          return job.status === 'COMPLETED' ? job : null;
        });
        assert.equal(done.has_previous_content, true);

        const enrolled = await call('POST', `/api/v1/student/courses/${courseId}/enrollments`, {
          token: student.token,
        });
        assert.equal(enrolled.status, 201);
        const content = expectData(
          await call('GET', `/api/v1/student/courses/${courseId}`, { token: student.token }),
          200,
        );
        const lesson = lessonDtoSchema.parse(content.lessons.find((item) => item.id === lessonId));
        assert.match(lesson.content_markdown ?? '', /Bài học do AI soạn/u);
      },
    );

    await t.test('GENERATE_QUIZ: quiz DRAFT được tạo trong khóa học', async () => {
      const jobsPath = `${lessonPath(courseId, lessonId)}/ai-jobs`;
      const created = await call('POST', jobsPath, {
        token: instructor.token,
        body: { job_type: 'GENERATE_QUIZ', media_ids: [mediaId], question_count: 1 },
      });
      const jobId = expectData(created, 202, lessonAiJobDtoSchema).id;
      const done = await waitUntil('job sinh quiz COMPLETED', async () => {
        const job = expectData(
          await call('GET', `${jobsPath}/${jobId}`, { token: instructor.token }),
          200,
        ).job;
        if (job.status === 'FAILED')
          throw new Error(`job FAILED: ${job.error_code} ${job.error_message}`);
        return job.status === 'COMPLETED' ? job : null;
      });
      assert.ok(done.result_quiz_id);
      const quiz = expectData(
        await call('GET', `${lessonPath(courseId, lessonId)}/quizzes/${done.result_quiz_id}`, {
          token: instructor.token,
        }),
        200,
        quizDtoSchema,
      );
      assert.equal(quiz.status, 'DRAFT');
      assert.equal(quiz.question_count, 1);
    });

    await t.test('provider giả nhận đúng API key đã giải mã ở mọi lượt gọi', async (subtest) => {
      if (!providerStatsUrl) return subtest.skip('thiếu REGRESSION_AI_PROVIDER_STATS_URL');
      const seen = await (await fetch(providerStatsUrl)).json();
      assert.ok(seen.chat_calls >= 2, `provider chỉ nhận ${seen.chat_calls} lượt chat`);
      assert.ok(seen.bearers.includes(apiKey), 'provider phải nhận API key đã giải mã');
      assert.ok(
        seen.bearers.every((bearer) => bearer.startsWith('sk-regression-key-')),
        `provider nhận Bearer không phải API key gốc (ciphertext?): ${seen.bearers}`,
      );
    });
  },
);
