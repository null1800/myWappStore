import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/product.dto';
import { generateSlug, makeSlugUnique } from './utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCategoryDto) {
    const baseSlug = dto.slug ?? generateSlug(dto.name);

    const slug = await makeSlugUnique(baseSlug, async (s) => {
      const existing = await this.prisma.category.findFirst({
        where: { tenantId, slug: s },
        select: { id: true },
      });
      return !!existing;
    });

    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async update(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Category not found.');

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(tenantId: string, categoryId: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });

    if (!existing) throw new NotFoundException('Category not found.');

    // Don't delete if products are assigned — reassign first
    if (existing._count.products > 0) {
      throw new ConflictException(
        `Cannot delete category — ${existing._count.products} product(s) are assigned to it. Reassign them first.`,
      );
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
    return { message: 'Category deleted.' };
  }
}
