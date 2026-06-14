using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.ProjectManagement.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "projectmanagement");

            migrationBuilder.CreateTable(
                name: "projects",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    LeadName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    NextIssueNumber = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "board_columns",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "todo"),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_board_columns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_board_columns_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "projectmanagement",
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "labels",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "#64748b"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_labels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_labels_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "projectmanagement",
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sprints",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Goal = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StartDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    EndDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "planned"),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sprints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sprints_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "projectmanagement",
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "issues",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IssueKey = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "task"),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "medium"),
                    BoardColumnId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssigneeId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssigneeName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ReporterName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    EpicId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SprintId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StoryPoints = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: true),
                    DueDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_issues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_issues_board_columns_BoardColumnId",
                        column: x => x.BoardColumnId,
                        principalSchema: "projectmanagement",
                        principalTable: "board_columns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_issues_issues_EpicId",
                        column: x => x.EpicId,
                        principalSchema: "projectmanagement",
                        principalTable: "issues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_issues_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "projectmanagement",
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_issues_sprints_SprintId",
                        column: x => x.SprintId,
                        principalSchema: "projectmanagement",
                        principalTable: "sprints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "issue_comments",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IssueId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_issue_comments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_issue_comments_issues_IssueId",
                        column: x => x.IssueId,
                        principalSchema: "projectmanagement",
                        principalTable: "issues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "issue_labels",
                schema: "projectmanagement",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IssueId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LabelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_issue_labels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_issue_labels_issues_IssueId",
                        column: x => x.IssueId,
                        principalSchema: "projectmanagement",
                        principalTable: "issues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_issue_labels_labels_LabelId",
                        column: x => x.LabelId,
                        principalSchema: "projectmanagement",
                        principalTable: "labels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_board_columns_ProjectId",
                schema: "projectmanagement",
                table: "board_columns",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_board_columns_TenantId",
                schema: "projectmanagement",
                table: "board_columns",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_issue_comments_IssueId",
                schema: "projectmanagement",
                table: "issue_comments",
                column: "IssueId");

            migrationBuilder.CreateIndex(
                name: "IX_issue_comments_TenantId",
                schema: "projectmanagement",
                table: "issue_comments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_issue_labels_IssueId_LabelId",
                schema: "projectmanagement",
                table: "issue_labels",
                columns: new[] { "IssueId", "LabelId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_issue_labels_LabelId",
                schema: "projectmanagement",
                table: "issue_labels",
                column: "LabelId");

            migrationBuilder.CreateIndex(
                name: "IX_issue_labels_TenantId",
                schema: "projectmanagement",
                table: "issue_labels",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_issues_BoardColumnId",
                schema: "projectmanagement",
                table: "issues",
                column: "BoardColumnId");

            migrationBuilder.CreateIndex(
                name: "IX_issues_EpicId",
                schema: "projectmanagement",
                table: "issues",
                column: "EpicId");

            migrationBuilder.CreateIndex(
                name: "IX_issues_ProjectId_IssueKey",
                schema: "projectmanagement",
                table: "issues",
                columns: new[] { "ProjectId", "IssueKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_issues_SprintId",
                schema: "projectmanagement",
                table: "issues",
                column: "SprintId");

            migrationBuilder.CreateIndex(
                name: "IX_issues_TenantId",
                schema: "projectmanagement",
                table: "issues",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_labels_ProjectId",
                schema: "projectmanagement",
                table: "labels",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_labels_TenantId",
                schema: "projectmanagement",
                table: "labels",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_projects_Key",
                schema: "projectmanagement",
                table: "projects",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_projects_TenantId",
                schema: "projectmanagement",
                table: "projects",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_sprints_ProjectId",
                schema: "projectmanagement",
                table: "sprints",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_sprints_TenantId",
                schema: "projectmanagement",
                table: "sprints",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "issue_comments",
                schema: "projectmanagement");

            migrationBuilder.DropTable(
                name: "issue_labels",
                schema: "projectmanagement");

            migrationBuilder.DropTable(
                name: "issues",
                schema: "projectmanagement");

            migrationBuilder.DropTable(
                name: "labels",
                schema: "projectmanagement");

            migrationBuilder.DropTable(
                name: "board_columns",
                schema: "projectmanagement");

            migrationBuilder.DropTable(
                name: "sprints",
                schema: "projectmanagement");

            migrationBuilder.DropTable(
                name: "projects",
                schema: "projectmanagement");
        }
    }
}
